// app.js - Core Engine Logic

// Ensure PDF.js worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const fileInput = document.getElementById('file-upload');
const flipbookContainer = document.getElementById('flipbook');
const emptyState = document.getElementById('empty-state');

let pageFlipInstance = null;

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Update UI
    emptyState.classList.add('hidden');
    flipbookContainer.classList.remove('hidden');
    flipbookContainer.innerHTML = '<div class="text-white">Loading document...</div>';

    // 2. Read the file into an ArrayBuffer
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result);

        try {
            // 3. Load the PDF document
            const pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
            console.log(`Loaded PDF with ${pdfDoc.numPages} pages.`);
            
            // Clear the loading text
            flipbookContainer.innerHTML = ''; 

            // 4. Initialize PageFlip
            pageFlipInstance = new St.PageFlip(flipbookContainer, {
                width: 400, // Base width of a page
                height: 600, // Base height
                size: "stretch",
                minWidth: 315,
                maxWidth: 1000,
                minHeight: 420,
                maxHeight: 1350,
                showCover: true,
                maxShadowOpacity: 0.5,
            });

            const pages = [];

            // 5. Render pages (Limiting to first 10 pages for initial testing to prevent browser freeze)
            const pagesToRender = Math.min(pdfDoc.numPages, 10); 
            
            for (let i = 1; i <= pagesToRender; i++) {
                const page = await pdfDoc.getPage(i);
                
                // Create a canvas for each page
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                // Adjust scale for quality
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render PDF page into canvas context
                await page.render({ canvasContext: context, viewport: viewport }).promise;

                // Convert canvas to a div format PageFlip expects
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page';
                pageDiv.appendChild(canvas);
                pages.push(pageDiv);
            }

            // 6. Feed the pages into the Flipbook
            pageFlipInstance.loadFromHTML(pages);

        } catch (error) {
            console.error("Error rendering PDF:", error);
            flipbookContainer.innerHTML = '<div class="text-red-500">Error loading PDF. Check console.</div>';
        }
    };

    fileReader.readAsArrayBuffer(file);
});
