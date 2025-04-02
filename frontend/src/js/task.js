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

    // Task History Management
    let taskHistory = [];

    function addTaskToHistory(taskName, taskDescription) {
        const task = {
            id: taskName,
            name: taskName,
            description: taskDescription,
            status: 'pending',
            sources: currentSources.length
        };

        taskHistory.unshift(task); // Add to beginning of array
        updateTaskHistoryUI();

        // Simulate task completion after 2 seconds
        setTimeout(() => {
            // Randomly set status to completed or failed
            const status = 'completed'
            task.status = status;
            updateTaskHistoryUI();
        }, 5000);
    }

    function updateTaskHistoryUI() {
        const taskHistoryList = document.querySelector('.task-history-list');
        taskHistoryList.innerHTML = '';

        taskHistory.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-history-item';
            taskElement.innerHTML = `
                <h4>${task.name}</h4>
                <p>${task.description || 'No description'}</p>
                <p>Sources: ${task.sources}</p>
                <div class="task-status status-${task.status}">
                    <i class="bi ${getStatusIcon(task.status)}"></i>
                    ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </div>
                <div class="task-actions mt-3">
                    <button class="btn btn-sm btn-primary show-analytics-btn" data-task-id="${task.id}">
                        <i class="bi bi-graph-up"></i> Show Analytics
                    </button>
                </div>
            `;

            // Add click event listener for the Show Analytics button
            const analyticsBtn = taskElement.querySelector('.show-analytics-btn');
            analyticsBtn.addEventListener('click', () => {
                showTaskAnalytics(task.id);
            });

            taskHistoryList.appendChild(taskElement);
        });
    }

    function getStatusIcon(status) {
        switch (status) {
            case 'pending':
                return 'bi-hourglass-split';
            case 'completed':
                return 'bi-check-circle';
            case 'failed':
                return 'bi-x-circle';
            default:
                return 'bi-question-circle';
        }
    }

    // Fetch existing tasks from backend
    async function fetchExistingTasks() {
        try {
            const response = await fetch('http://localhost:8001/tasks');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Add existing tasks to history
            data.tasks.forEach(task => {
                taskHistory.push({
                    id: task.task_name,
                    name: task.task_name,
                    description: 'Existing task',
                    status: 'completed',
                    sources: task.record_count
                });
            });
            
            updateTaskHistoryUI();
        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    }

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

            // Add task to history immediately with pending status
            addTaskToHistory(taskName, taskDescription);

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

    // Function to show task analytics
    async function showTaskAnalytics(taskId) {
        try {
            const response = await fetch(`http://localhost:8001/tasks/${taskId}/analytics`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Store the original data for filtering
            window.chartData = {
                company: data.company_chart_data,
                model: data.model_chart_data
            };
            
            // Show the chart container
            const chartContainer = document.getElementById('chart-container');
            chartContainer.style.display = 'block';
            
            // Display analytics data
            document.getElementById('visualization').innerHTML = `
                <div class="analytics-container">
                    <div class="analytics-summary mb-4">
                        <h4>Summary</h4>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5 class="card-title">Total Sales</h5>
                                        <p class="card-text display-6">${data.summary.total_sales}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5 class="card-title">Total Revenue</h5>
                                        <p class="card-text display-6">$${data.summary.total_revenue.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5 class="card-title">Average Price</h5>
                                        <p class="card-text display-6">$${data.summary.average_price.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="analytics-charts mb-4">
                        <div class="row">
                            <div class="col-12">
                                <div class="chart-card">
                                    <div class="chart-header">
                                        <h4>Sales by Company</h4>
                                        <div class="chart-filters">
                                            <div class="filter-group">
                                                <label>Sort by:</label>
                                                <select class="form-select form-select-sm" id="company-sort">
                                                    <option value="count">Count</option>
                                                    <option value="revenue">Revenue</option>
                                                </select>
                                            </div>
                                            <div class="filter-group">
                                                <label>Order:</label>
                                                <select class="form-select form-select-sm" id="company-order">
                                                    <option value="desc">Descending</option>
                                                    <option value="asc">Ascending</option>
                                                </select>
                                            </div>
                                            <div class="filter-group">
                                                <label>Min Count:</label>
                                                <input type="number" class="form-control form-control-sm" id="company-min-count" min="0">
                                            </div>
                                        </div>
                                    </div>
                                    <div id="company-chart" class="chart"></div>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="chart-card">
                                    <div class="chart-header">
                                        <h4>Sales by Model</h4>
                                        <div class="chart-filters">
                                            <div class="filter-group">
                                                <label>Sort by:</label>
                                                <select class="form-select form-select-sm" id="model-sort">
                                                    <option value="count">Count</option>
                                                    <option value="revenue">Revenue</option>
                                                </select>
                                            </div>
                                            <div class="filter-group">
                                                <label>Order:</label>
                                                <select class="form-select form-select-sm" id="model-order">
                                                    <option value="desc">Descending</option>
                                                    <option value="asc">Ascending</option>
                                                </select>
                                            </div>
                                            <div class="filter-group">
                                                <label>Min Count:</label>
                                                <input type="number" class="form-control form-control-sm" id="model-min-count" min="0">
                                            </div>
                                        </div>
                                    </div>
                                    <div id="model-chart" class="chart"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="analytics-data">
                        <h4>Detailed Sales Data</h4>
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Sale ID</th>
                                        <th>Company</th>
                                        <th>Model</th>
                                        <th>Year</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.sales_data.map(sale => `
                                        <tr>
                                            <td>${sale.sale_id}</td>
                                            <td>${sale.company}</td>
                                            <td>${sale.car_model}</td>
                                            <td>${sale.manufacturing_year}</td>
                                            <td>$${parseFloat(sale.price).toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Create initial charts
            createBarChart('#company-chart', data.company_chart_data, 'company', 'count', 'Sales by Company');
            createBarChart('#model-chart', data.model_chart_data, 'model', 'count', 'Sales by Model');

            // Add event listeners for filters
            setupChartFilters();

        } catch (error) {
            console.error('Error fetching task analytics:', error);
            alert('Error fetching task analytics. Please try again.');
        }
    }

    // Function to setup chart filters
    function setupChartFilters() {
        // Company chart filters
        document.getElementById('company-sort').addEventListener('change', () => updateChart('#company-chart', 'company'));
        document.getElementById('company-order').addEventListener('change', () => updateChart('#company-chart', 'company'));
        document.getElementById('company-min-count').addEventListener('input', () => updateChart('#company-chart', 'company'));

        // Model chart filters
        document.getElementById('model-sort').addEventListener('change', () => updateChart('#model-chart', 'model'));
        document.getElementById('model-order').addEventListener('change', () => updateChart('#model-chart', 'model'));
        document.getElementById('model-min-count').addEventListener('input', () => updateChart('#model-chart', 'model'));
    }

    // Function to update chart based on filters
    function updateChart(selector, type) {
        const sortBy = document.getElementById(`${type}-sort`).value;
        const order = document.getElementById(`${type}-order`).value;
        const minCount = parseInt(document.getElementById(`${type}-min-count`).value) || 0;

        // Filter and sort data
        let filteredData = window.chartData[type].filter(d => d.count >= minCount);
        
        if (sortBy === 'count') {
            filteredData.sort((a, b) => order === 'desc' ? b.count - a.count : a.count - b.count);
        } else {
            filteredData.sort((a, b) => order === 'desc' ? b.total_revenue - a.total_revenue : a.total_revenue - b.total_revenue);
        }

        // Update chart
        createBarChart(selector, filteredData, type === 'company' ? 'company' : 'model', sortBy, `Sales by ${type === 'company' ? 'Company' : 'Model'}`);
    }

    // Function to create a bar chart using D3.js
    function createBarChart(selector, data, xKey, yKey, title) {
        // Clear any existing chart
        d3.select(selector).html('');
        
        // Get container width
        const containerWidth = d3.select(selector).node().getBoundingClientRect().width;
        
        // Set dimensions and margins
        const margin = {top: 20, right: 30, bottom: 40, left: 60};
        const width = containerWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        
        // Create SVG
        const svg = d3.select(selector)
            .append('svg')
            .attr('width', '100%')
            .attr('height', height + margin.top + margin.bottom)
            .attr('viewBox', [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text(title);
        
        // X scale
        const x = d3.scaleBand()
            .domain(data.map(d => d[xKey]))
            .range([0, width])
            .padding(0.1);
        
        // Y scale
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d[yKey])])
            .nice()
            .range([height, 0]);
        
        // Add X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');
        
        // Add Y axis
        svg.append('g')
            .call(d3.axisLeft(y));
        
        // Create tooltip
        const tooltip = d3.select(selector)
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('opacity', 0);
        
        // Add bars with interactions
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d[xKey]))
            .attr('y', d => y(d[yKey]))
            .attr('width', x.bandwidth())
            .attr('height', d => height - y(d[yKey]))
            .attr('fill', '#3498db')
            .on('mouseover', function(event, d) {
                // Highlight the bar
                d3.select(this)
                    .attr('fill', '#2980b9')
                    .attr('stroke', '#2c3e50')
                    .attr('stroke-width', 2);
                
                // Show tooltip
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    <strong>${d[xKey]}</strong><br/>
                    Count: ${d.count}<br/>
                    Revenue: $${d.total_revenue.toLocaleString()}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
                
                // Highlight corresponding row in table
                highlightTableRow(d[xKey]);
            })
            .on('mouseout', function() {
                // Reset bar style
                d3.select(this)
                    .attr('fill', '#3498db')
                    .attr('stroke', 'none')
                    .attr('stroke-width', 0);
                
                // Hide tooltip
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
                
                // Reset table row
                resetTableRows();
            })
            .on('click', function(event, d) {
                // Toggle selection
                const isSelected = d3.select(this).classed('selected');
                d3.selectAll('.bar').classed('selected', false);
                d3.select(this).classed('selected', !isSelected);
                
                // Update table to show only selected items
                updateTableFilter(d[xKey], !isSelected);
            });
        
        // Add value labels on top of bars
        svg.selectAll('.value-label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'value-label')
            .attr('x', d => x(d[xKey]) + x.bandwidth() / 2)
            .attr('y', d => y(d[yKey]) - 5)
            .attr('text-anchor', 'middle')
            .text(d => d[yKey]);
    }

    // Function to highlight table row
    function highlightTableRow(value) {
        d3.selectAll('table tbody tr')
            .filter(d => d && d.company === value || d && d.car_model === value)
            .classed('highlighted', true);
    }

    // Function to reset table rows
    function resetTableRows() {
        d3.selectAll('table tbody tr')
            .classed('highlighted', false);
    }

    // Function to update table filter
    function updateTableFilter(value, isSelected) {
        const rows = d3.selectAll('table tbody tr');
        if (isSelected) {
            rows.style('display', d => d && (d.company === value || d.car_model === value) ? '' : 'none');
        } else {
            rows.style('display', '');
        }
    }

    // Fetch existing tasks when the page loads
    fetchExistingTasks();
}); 