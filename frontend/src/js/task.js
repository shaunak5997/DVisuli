document.addEventListener('DOMContentLoaded', function() {
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskPane = document.getElementById('task-pane');
    const addSourceBtn = document.getElementById('add-source-btn');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const sourcesList = document.getElementById('sources-list');
    const sourcesCount = document.getElementById('sources-count');
    const uploadModal = new bootstrap.Modal(document.getElementById('upload-modal'));
    const confirmUploadBtn = document.getElementById('confirm-upload');
    
    let isTaskPaneVisible = false;
    let currentSources = [];
    let currentUploadData = null;

    // Function to update generate report button state
    function updateGenerateReportButton() {
        const canGenerate = currentSources.length >= 2;
        generateReportBtn.disabled = !canGenerate;
        generateReportBtn.classList.toggle('btn-primary', canGenerate);
        generateReportBtn.classList.toggle('btn-secondary', !canGenerate);
        
        // Update sources count message
        if (currentSources.length === 0) {
            sourcesCount.textContent = 'Add at least 2 sources to generate a report';
        } else if (currentSources.length === 1) {
            sourcesCount.textContent = 'Add 1 more source to generate a report';
        } else {
            sourcesCount.textContent = `Ready to generate report with ${currentSources.length} sources`;
            sourcesCount.classList.add('text-success');
        }
    }

    // Handle Add Task button click
    addTaskBtn.addEventListener('click', function() {
        isTaskPaneVisible = !isTaskPaneVisible;
        taskPane.style.display = isTaskPaneVisible ? 'block' : 'none';
        
        // Update button text and icon
        const buttonIcon = addTaskBtn.querySelector('i');
        if (isTaskPaneVisible) {
            buttonIcon.classList.remove('bi-plus-circle');
            buttonIcon.classList.add('bi-x-circle');
            addTaskBtn.innerHTML = '<i class="bi bi-x-circle"></i> Close Task';
        } else {
            buttonIcon.classList.remove('bi-x-circle');
            buttonIcon.classList.add('bi-plus-circle');
            addTaskBtn.innerHTML = '<i class="bi bi-plus-circle"></i> Add Task';
        }
    });

    // Handle Add Source button click
    addSourceBtn.addEventListener('click', function() {
        uploadModal.show();
    });

    // Handle Confirm Upload button click
    confirmUploadBtn.addEventListener('click', function() {
        if (currentUploadData) {
            const filters = document.getElementById('source-filters').value.trim();
            currentUploadData.filters = filters;
            addSourceToList(currentUploadData);
            currentUploadData = null;
            uploadModal.hide();
            // Reset the upload form
            document.getElementById('file-input').value = '';
            document.getElementById('url-input').value = '';
            document.getElementById('source-filters').value = '';
            document.getElementById('upload-status').innerHTML = '';
            updateGenerateReportButton();
        }
    });

    // Function to add a source to the list
    function addSourceToList(data) {
        const sourceId = Date.now(); // Unique ID for the source
        const sourceName = data.name || `Source ${currentSources.length + 1}`;
        const sourceType = data.type || 'Unknown';
        const filters = data.filters || '';
        
        const sourceItem = document.createElement('div');
        sourceItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        sourceItem.innerHTML = `
            <div>
                <h6 class="mb-1">${sourceName}</h6>
                <small class="text-muted">Type: ${sourceType}</small>
                ${filters ? `<small class="d-block text-muted mt-1">
                    <i class="bi bi-funnel"></i> Filters: ${filters}
                </small>` : ''}
            </div>
            <div>
                <button class="btn btn-sm btn-outline-danger delete-source" data-id="${sourceId}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        // Add delete functionality
        const deleteBtn = sourceItem.querySelector('.delete-source');
        deleteBtn.addEventListener('click', function() {
            sourceItem.remove();
            currentSources = currentSources.filter(source => source.id !== sourceId);
            updateGenerateReportButton();
        });

        sourcesList.appendChild(sourceItem);
        currentSources.push({
            id: sourceId,
            name: sourceName,
            type: sourceType,
            filters: filters,
            data: data
        });
    }

    // Handle Generate Report button click
    generateReportBtn.addEventListener('click', async function() {
        try {
            // Get task details
            const taskName = document.getElementById('task-name').value;
            const taskDescription = document.getElementById('task-description').value;

            if (!taskName) {
                alert('Please enter a task name');
                return;
            }

            if (currentSources.length < 2) {
                alert('Please add at least two data sources');
                return;
            }

            // Prepare form data
            const formData = new FormData();
            formData.append('task_name', taskName);
            formData.append('task_description', taskDescription);

            // Add sources from currentSources array
            const files = [];
            const urls = [];
            
            currentSources.forEach(source => {
                if (source.data.file) {
                    files.push(source.data.file);
                } else if (source.data.url) {
                    urls.push(source.data.url);
                }
            });

            // Add files to form data
            files.forEach(file => {
                formData.append('sources', file);
            });

            // Add URLs to form data
            if (urls.length > 0) {
                formData.append('source_urls', JSON.stringify(urls));
            }

            // Show loading state
            generateReportBtn.disabled = true;
            generateReportBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating Report...';

            // Call the API
            const response = await fetch('http://localhost:8001/generate-report', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Show success message
            alert('Report generated successfully!');
            
            // Reset form
            document.getElementById('task-name').value = '';
            document.getElementById('task-description').value = '';
            sourcesList.innerHTML = '';
            currentSources = [];
            isTaskPaneVisible = false;
            updateGenerateReportButton();

            // Reset Add Task button
            addTaskBtn.innerHTML = '<i class="bi bi-plus-circle"></i> Add Task';

        } catch (error) {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again.');
        } finally {
            // Reset button state
            generateReportBtn.disabled = false;
            generateReportBtn.innerHTML = '<i class="bi bi-play-circle"></i> Generate Report';
        }
    });

    // Handle file upload
    document.getElementById('file-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            currentUploadData = {
                name: file.name,
                type: file.type,
                file: file
            };
            document.getElementById('upload-status').innerHTML = `
                <div class="alert alert-success mt-3">
                    <i class="bi bi-check-circle"></i> File selected: ${file.name}
                </div>
            `;
        }
    });

    // Handle URL upload
    document.getElementById('url-submit').addEventListener('click', function() {
        const url = document.getElementById('url-input').value;
        if (url) {
            currentUploadData = {
                name: url,
                type: 'URL',
                url: url
            };
            document.getElementById('upload-status').innerHTML = `
                <div class="alert alert-success mt-3">
                    <i class="bi bi-check-circle"></i> URL entered: ${url}
                </div>
            `;
        }
    });
}); 