// app.js - Core Engine Logic with Bulletproof Loading

// 1. Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const flipbookContainer = document.getElementById('flipbook');
const emptyState = document.getElementById('empty-state');

let pageFlipInstance = null;
let fabricCanvases = []; 

// --- TOOL STATE MANAGEMENT ---
const toolBtns = document.querySelectorAll('#tool-group .tool-btn[data-tool]');
let currentTool = 'select';

toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        updateToolInteractions();
    });
});

function updateToolInteractions() {
    if (fabricCanvases.length === 0) return;

    if (currentTool === 'select') {
        // READING MODE
        setFabricPointerEvents('none');
        setFabricDrawingMode(false);
    } else {
        // EDITING MODE
        setFabricPointerEvents('auto');
        
        if (currentTool === 'pen') {
            setFabricDrawingMode(true, '#ef4444', 3); // Red pen for visibility
        } else if (currentTool === 'highlight') {
            setFabricDrawingMode(true, 'rgba(250, 204, 21, 0.4)', 20); // Yellow highlighter
        } else if (currentTool === 'eraser') {
            setFabricDrawingMode(false);
            enableEraserClicks();
        }
    }
}

function setFabricPointerEvents(state) {
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

// Helper function to show status on screen
function updateStatus(message, isError = false) {
    if (isError) {
        flipbookContainer.innerHTML = `<div class="bg-red-900/50 text-red-400 p-6 rounded border border-red-700 max-w-md text-center"><i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i><br/>${message}</div>`;
        console.error(message);
    } else {
        flipbookContainer.innerHTML = `<div class="text-sky-400 animate-pulse flex flex-col items-center"><i class="fa-solid fa-spinner fa-spin text-3xl mb-2"></i>${message}</div>`;
        console.log(message);
    }
}

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset UI
    emptyState.classList.add('hidden');
    flipbookContainer.classList.remove('hidden');
    
    // Destroy previous book if one exists
    if (pageFlipInstance) {
        pageFlipInstance.destroy();
        pageFlipInstance = null;
    }
    fabricCanvases = []; 
    flipbookContainer.innerHTML = ''; 

    updateStatus(`Reading file: ${file.name}...`);

    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
        updateStatus("File read successfully. Decoding PDF...");
        const typedarray = new Uint8Array(this.result);

        try {
            // FIX: Ensure data is wrapped in an object for PDF.js
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            const pdfDoc = await loadingTask.promise;
            
            updateStatus(`PDF decoded. Contains ${pdfDoc.numPages} pages. Rendering...`);

            // Clear container before injecting pages
            flipbookContainer.innerHTML = '';

            const pagesToRender = Math.min(pdfDoc.numPages, 10); // Limit to 10 for testing
            
            for (let i = 1; i <= pagesToRender; i++) {
                const page = await pdfDoc.getPage(i);
                
                // Create DOM elements
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page';
                pageDiv.style.position = 'relative'; 
                pageDiv.style.backgroundColor = '#ffffff';

                // Background Canvas (PDF render)
                const bgCanvas = document.createElement('canvas');
                const bgContext = bgCanvas.getContext('2d');
                
                const viewport = page.getViewport({ scale: 1.5 });
                bgCanvas.width = viewport.width;
                bgCanvas.height = viewport.height;
                bgCanvas.style.width = '100%'; 
                bgCanvas.style.height = '100%';

                await page.render({ canvasContext: bgContext, viewport: viewport }).promise;
                pageDiv.appendChild(bgCanvas);

                // Foreground Canvas (Fabric.js layer)
                const fgCanvas = document.createElement('canvas');
                fgCanvas.id = `fabric-page-${i}`; 
                fgCanvas.style.position = 'absolute'; 
                fgCanvas.style.top = '0';
                fgCanvas.style.left = '0';
                pageDiv.appendChild(fgCanvas);

                // FIX: Append directly to DOM first before PageFlip takes over
                flipbookContainer.appendChild(pageDiv);
            }

            // Initialize PageFlip using the elements now in the DOM
            pageFlipInstance = new St.PageFlip(flipbookContainer, {
                width: 450, 
                height: 600, 
                size: "fit", // Changed from stretch to fit to preserve book aspect ratio
                minWidth: 300,
                maxWidth: 800,
                minHeight: 400,
                maxHeight: 1000,
                showCover: true,
                maxShadowOpacity: 0.3,
            });

            // Grab the newly appended pages and load them into the engine
            const domPages = document.querySelectorAll('#flipbook .page');
            pageFlipInstance.loadFromHTML(domPages);

            // Initialize Fabric Canvases
            domPages.forEach((pageDiv, index) => {
                const canvasElement = pageDiv.querySelector(`canvas[id^="fabric-page-"]`);
                if (canvasElement) {
                    const fCanvas = new fabric.Canvas(canvasElement.id, {
                        width: pageDiv.clientWidth,
                        height: pageDiv.clientHeight,
                        isDrawingMode: false
                    });
                    fabricCanvases.push(fCanvas);
                }
            });

            // Ensure tools are set to 'Select' by default
            updateToolInteractions();

        } catch (error) {
            updateStatus(`Failed to load PDF: ${error.message}`, true);
        }
    };

    // Trigger the file read
    fileReader.readAsArrayBuffer(file);
});
