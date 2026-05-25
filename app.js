// app.js - Core Engine Logic with Fabric.js Integration

// Ensure PDF.js worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const flipbookContainer = document.getElementById('flipbook');
const emptyState = document.getElementById('empty-state');

let pageFlipInstance = null;
let fabricCanvases = []; // Store our drawing layers

// --- TOOL STATE MANAGEMENT ---
// We grab the tool buttons and set up a listener to change modes
const toolBtns = document.querySelectorAll('#tool-group .tool-btn[data-tool]');
let currentTool = 'select';

toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentTool = btn.dataset.tool;
        updateToolInteractions();
    });
});

function updateToolInteractions() {
    if (!pageFlipInstance) return;

    if (currentTool === 'select') {
        // READING MODE: Enable page flipping, disable drawing
        // Note: StPageFlip doesn't have a direct "disable" method in the free version,
        // so we manage it by changing CSS pointer-events on the fabric layers.
        setFabricPointerEvents('none');
        setFabricDrawingMode(false);
    } else {
        // EDITING MODE: Disable page flipping, enable drawing
        setFabricPointerEvents('auto');
        
        if (currentTool === 'pen') {
            setFabricDrawingMode(true, 'black', 2);
        } else if (currentTool === 'highlight') {
            setFabricDrawingMode(true, 'rgba(255, 255, 0, 0.4)', 15);
        } else if (currentTool === 'eraser') {
            // A true eraser is complex in Fabric, so we disable drawing 
            // and let the user click objects to delete them for now.
            setFabricDrawingMode(false);
            enableEraserClicks();
        }
    }
}

function setFabricPointerEvents(state) {
    // When pointer-events are 'none', clicks pass through to the page-flip engine beneath
    const canvasContainers = document.querySelectorAll('.canvas-container');
    canvasContainers.forEach(container => {
        container.style.pointerEvents = state;
    });
}

function setFabricDrawingMode(isDrawing, color = 'black', width = 2) {
    fabricCanvases.forEach(canvas => {
        canvas.isDrawingMode = isDrawing;
        if (isDrawing) {
            canvas.freeDrawingBrush.color = color;
            canvas.freeDrawingBrush.width = width;
        }
        // Remove object selection listeners used by the eraser
        canvas.off('mouse:down'); 
    });
}

function enableEraserClicks() {
    fabricCanvases.forEach(canvas => {
        canvas.on('mouse:down', function(options) {
            if (options.target && currentTool === 'eraser') {
                canvas.remove(options.target);
            }
        });
    });
}

// --- PDF UPLOAD AND RENDERING ---
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    emptyState.classList.add('hidden');
    flipbookContainer.classList.remove('hidden');
    flipbookContainer.innerHTML = '<div class="text-white">Loading document...</div>';
    
    // Clear previous canvases if a new book is loaded
    fabricCanvases = []; 

    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);

        try {
            const pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
            flipbookContainer.innerHTML = ''; 

            pageFlipInstance = new St.PageFlip(flipbookContainer, {
                width: 450, 
                height: 650, 
                size: "stretch",
                minWidth: 315,
                maxWidth: 1000,
                minHeight: 420,
                maxHeight: 1350,
                showCover: true,
                maxShadowOpacity: 0.5,
            });

            const pages = [];
            const pagesToRender = Math.min(pdfDoc.numPages, 10); 
            
            for (let i = 1; i <= pagesToRender; i++) {
                const page = await pdfDoc.getPage(i);
                
                // 1. Create a container for the page
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page relative'; // relative is important for layering

                // 2. Create the background canvas (PDF.js rendering)
                const bgCanvas = document.createElement('canvas');
                const bgContext = bgCanvas.getContext('2d');
                
                const viewport = page.getViewport({ scale: 1.5 });
                bgCanvas.width = viewport.width;
                bgCanvas.height = viewport.height;
                bgCanvas.style.width = '100%'; // Ensure it fills the pageDiv
                bgCanvas.style.height = '100%';

                await page.render({ canvasContext: bgContext, viewport: viewport }).promise;
                pageDiv.appendChild(bgCanvas);

                // 3. Create the foreground canvas (Fabric.js drawing layer)
                const fgCanvas = document.createElement('canvas');
                // ID must be unique for Fabric to hook into it
                fgCanvas.id = `fabric-page-${i}`; 
                // We overlay it exactly on top of the background canvas
                fgCanvas.style.position = 'absolute'; 
                fgCanvas.style.top = '0';
                fgCanvas.style.left = '0';
                pageDiv.appendChild(fgCanvas);

                pages.push(pageDiv);
            }

            pageFlipInstance.loadFromHTML(pages);

            // 4. Initialize Fabric on all foreground canvases AFTER they are added to the DOM
            setTimeout(() => {
                const domPages = document.querySelectorAll('.page');
                domPages.forEach((pageDiv, index) => {
                    const canvasElement = pageDiv.querySelector(`canvas[id^="fabric-page-"]`);
                    if (canvasElement) {
                        const fCanvas = new fabric.Canvas(canvasElement.id, {
                            width: pageDiv.clientWidth,
                            height: pageDiv.clientHeight,
                            isDrawingMode: false // Start in reading mode
                        });
                        fabricCanvases.push(fCanvas);
                    }
                });
                
                // Set initial state to match the default selected tool
                updateToolInteractions();
            }, 100); // Small delay to let StPageFlip format the DOM

        } catch (error) {
            console.error("Error rendering PDF:", error);
            flipbookContainer.innerHTML = '<div class="text-red-500">Error loading PDF. Check console.</div>';
        }
    };

    fileReader.readAsArrayBuffer(file);
});
