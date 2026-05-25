// app.js - Core Engine Logic with Fabric.js Integration

// WRAPPER: This creates a private scope to prevent SyntaxErrors with index.html
(() => {
    // Ensure PDF.js worker is configured
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    const fileInput = document.getElementById('file-upload');
    const flipbookContainer = document.getElementById('flipbook');
    const emptyState = document.getElementById('empty-state');

    let pageFlipInstance = null;
    let fabricCanvases = []; 

    // --- TOOL STATE MANAGEMENT ---
    // We rename the variables slightly in this private bubble to be extra safe
    const appToolButtons = document.querySelectorAll('#tool-group .tool-btn[data-tool]');
    let activeToolMode = 'select';

    appToolButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeToolMode = btn.dataset.tool;
            updateToolInteractions();
        });
    });

    function updateToolInteractions() {
        if (fabricCanvases.length === 0) return;

        if (activeToolMode === 'select') {
            // READING MODE: Let clicks pass through to StPageFlip
            setFabricPointerEvents('none');
            setFabricDrawingMode(false);
        } else {
            // EDITING MODE: Catch clicks on the drawing layer
            setFabricPointerEvents('auto');
            
            if (activeToolMode === 'pen') {
                setFabricDrawingMode(true, '#ef4444', 3); // Red pen for visibility
            } else if (activeToolMode === 'highlight') {
                setFabricDrawingMode(true, 'rgba(250, 204, 21, 0.4)', 20); // Yellow highlight
            } else if (activeToolMode === 'eraser') {
                setFabricDrawingMode(false);
                enableEraserClicks();
            }
        }
    }

    function setFabricPointerEvents(state) {
        // This targets the wrapper divs Fabric.js creates automatically
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
            canvas.off('mouse:down'); // Remove eraser listeners
        });
    }

    function enableEraserClicks() {
        fabricCanvases.forEach(canvas => {
            canvas.on('mouse:down', function(options) {
                if (options.target && activeToolMode === 'eraser') {
                    canvas.remove(options.target);
                }
            });
        });
    }

    // --- PDF UPLOAD AND RENDERING ---
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset UI
        emptyState.classList.add('hidden');
        flipbookContainer.classList.remove('hidden');
        
        // Clean up previous book if one exists
        if (pageFlipInstance) {
            pageFlipInstance.destroy();
            pageFlipInstance = null;
        }
        fabricCanvases = []; 
        flipbookContainer.innerHTML = '<div class="text-sky-400 animate-pulse flex flex-col items-center mt-20"><i class="fa-solid fa-spinner fa-spin text-3xl mb-2"></i>Loading Book...</div>';

        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);

            try {
                // Reverted back to the Version 1 loading method that worked for you!
                const pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
                flipbookContainer.innerHTML = ''; 

                const pagesToRender = Math.min(pdfDoc.numPages, 10); 
                
                for (let i = 1; i <= pagesToRender; i++) {
                    const page = await pdfDoc.getPage(i);
                    
                    // 1. Create a container for the page
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'page';
                    pageDiv.style.position = 'relative'; 
                    pageDiv.style.backgroundColor = '#ffffff';

                    // 2. Background Canvas (PDF Render)
                    const bgCanvas = document.createElement('canvas');
                    const bgContext = bgCanvas.getContext('2d');
                    
                    const viewport = page.getViewport({ scale: 1.5 });
                    bgCanvas.width = viewport.width;
                    bgCanvas.height = viewport.height;
                    bgCanvas.style.width = '100%'; 
                    bgCanvas.style.height = '100%';

                    await page.render({ canvasContext: bgContext, viewport: viewport }).promise;
                    pageDiv.appendChild(bgCanvas);

                    // 3. Foreground Canvas (Fabric.js Layer)
                    const fgCanvas = document.createElement('canvas');
                    fgCanvas.id = `fabric-page-${i}`; 
                    fgCanvas.style.position = 'absolute'; 
                    fgCanvas.style.top = '0';
                    fgCanvas.style.left = '0';
                    pageDiv.appendChild(fgCanvas);

                    flipbookContainer.appendChild(pageDiv);
                }

                // 4. Initialize PageFlip
                pageFlipInstance = new St.PageFlip(flipbookContainer, {
                    width: 450, 
                    height: 600, 
                    size: "stretch",
                    minWidth: 300,
                    maxWidth: 800,
                    minHeight: 400,
                    maxHeight: 1000,
                    showCover: true,
                    maxShadowOpacity: 0.3,
                });

                const domPages = document.querySelectorAll('#flipbook .page');
                pageFlipInstance.loadFromHTML(domPages);

                // 5. Initialize Fabric Canvases AFTER they are fully integrated
                setTimeout(() => {
                    domPages.forEach((pageDiv) => {
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

                    // Set default tool state
                    updateToolInteractions();
                }, 150);

            } catch (error) {
                console.error(error);
                flipbookContainer.innerHTML = `<div class="text-red-500 mt-20">Error rendering PDF: ${error.message}</div>`;
            }
        };

        fileReader.readAsArrayBuffer(file);
    });

})(); // END WRAPPER
