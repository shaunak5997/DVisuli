// frontend/src/js/upload.js
document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and panes
            tabBtns.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to current button and pane
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // File Upload functionality
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when dragging file over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        handleFile(file);
    }
    
    // Handle selected files
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            handleFile(this.files[0]);
        }
    });
    
    function handleFile(file) {
        const validTypes = ['application/json', 'text/csv'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (!validTypes.includes(file.type) && !['json', 'csv'].includes(fileExtension)) {
            showUploadStatus('Please upload a JSON or CSV file.', 'error');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const fileData = e.target.result;
            processData(fileData, fileExtension);
        };
        
        reader.onerror = function() {
            showUploadStatus('Error reading file', 'error');
        };
        
        reader.readAsText(file);
    }
    
    // URL Upload functionality
    const urlInput = document.getElementById('url-input');
    const urlSubmit = document.getElementById('url-submit');
    
    urlSubmit.addEventListener('click', function() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showUploadStatus('Please enter a URL', 'error');
            return;
        }
        
        // Check if URL ends with .json or .csv
        const fileExtension = url.split('.').pop().toLowerCase();
        
        fetchDataFromUrl(url, fileExtension);
    });
    
    function fetchDataFromUrl(url, fileExtension) {
        showUploadStatus('Fetching data...', 'info');
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                processData(data, fileExtension);
            })
            .catch(error => {
                showUploadStatus(`Error fetching data: ${error.message}`, 'error');
            });
    }
    
    // Process and display data
    function processData(data, fileExtension) {
        try {
            let parsedData;
            
            if (fileExtension === 'json') {
                parsedData = JSON.parse(data);
            } else if (fileExtension === 'csv') {
                parsedData = parseCSV(data);
            }
            
            // Store the data globally for visualization
            window.visualizationData = parsedData;
            
            showUploadStatus('Data loaded successfully!', 'success');
            document.getElementById('chart-container').style.display = 'block';
            
            // Call visualization function (defined in main.js)
            if (typeof createVisualization === 'function') {
                createVisualization(parsedData);
            }
        } catch (error) {
            showUploadStatus(`Error processing data: ${error.message}`, 'error');
        }
    }
    
    function parseCSV(csvData) {
        // Simple CSV parser
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const obj = {};
            const currentLine = lines[i].split(',');
            
            for (let j = 0; j < headers.length; j++) {
                // Try to convert to number if possible
                const value = currentLine[j].trim();
                obj[headers[j]] = isNaN(value) ? value : Number(value);
            }
            
            result.push(obj);
        }
        
        return result;
    }
    
    function showUploadStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.className = 'upload-status';
        uploadStatus.classList.add(type);
    }
});