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
                <p>Items: ${task.sources}</p>
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
    async function showTaskAnalytics(taskName) {
        try {
            const response = await fetch(`http://localhost:8001/tasks/${taskName}/analytics`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Validate data structure
            if (!data || !data.summary || !data.sales_data) {
                throw new Error('Invalid data structure received from server');
            }
            
            // Get the analytics section and container
            let analyticsSection = document.getElementById('analyticsSection');
            let container = document.getElementById('analyticsContainer');
            
            if (!analyticsSection || !container) {
                console.error('Analytics section elements not found. Creating them...');
                
                // Create analytics section if it doesn't exist
                const taskHistoryPane = document.querySelector('.task-history-pane');
                if (!taskHistoryPane) {
                    throw new Error('Task history pane not found');
                }
                
                const newAnalyticsSection = document.createElement('div');
                newAnalyticsSection.id = 'analyticsSection';
                newAnalyticsSection.className = 'analytics-section';
                newAnalyticsSection.innerHTML = `
                    <div class="analytics-container">
                        <div id="analyticsContainer">
                            <div class="charts-container">
                                <div id="companyChart" class="chart"></div>
                                <div id="monthlyChart" class="chart"></div>
                            </div>
                        </div>
                    </div>
                    <div id="tooltip"></div>
                `;
                
                // Insert before the task history pane
                taskHistoryPane.parentNode.insertBefore(newAnalyticsSection, taskHistoryPane);
                
                // Update references
                analyticsSection = document.getElementById('analyticsSection');
                container = document.getElementById('analyticsContainer');
            }
            
            // Show the analytics section
            analyticsSection.style.display = 'block';
            
            // Clear the container
            container.innerHTML = '';
            
            // Add charts container
            const chartsContainer = document.createElement('div');
            chartsContainer.className = 'charts-container';
            chartsContainer.innerHTML = `
                <div id="companyChart" class="chart"></div>
                <div id="monthlyChart" class="chart"></div>
            `;
            container.appendChild(chartsContainer);
            
            // Process data for charts
            const companyChartData = processCompanyChartData(data.sales_data);
            const monthlyChartData = processMonthlyChartData(data.sales_data);
            
            // Create charts only if we have data
            if (companyChartData.length > 0) {
                createBarChart(companyChartData, 'companyChart', 'Sales by Company', 'company', 'total_sales', '#4CAF50');
            }
            
            if (monthlyChartData.length > 0) {
                createBarChart(monthlyChartData, 'monthlyChart', 'Average Sale Price Over Time', 'month', 'average_price', '#2196F3', true);
            }
            
            // Scroll to analytics section
            analyticsSection.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error fetching analytics:', error);
            alert('Error fetching analytics. Please try again.');
        }
    }

    // Helper function to process data for company chart
    function processCompanyChartData(salesData) {
        const companyData = {};
        salesData.forEach(sale => {
            if (!companyData[sale.company]) {
                companyData[sale.company] = {
                    company: sale.company,
                    total_sales: 0,
                    total_revenue: 0
                };
            }
            companyData[sale.company].total_sales += 1;
            companyData[sale.company].total_revenue += sale.price;
        });
        return Object.values(companyData);
    }

    // Helper function to process data for monthly chart
    function processMonthlyChartData(salesData) {
        const monthlyData = {};
        salesData.forEach(sale => {
            const date = new Date(sale.date_of_sale);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    total_revenue: 0,
                    count: 0,
                    average_price: 0
                };
            }
            monthlyData[monthKey].total_revenue += sale.price;
            monthlyData[monthKey].count += 1;
            monthlyData[monthKey].average_price = monthlyData[monthKey].total_revenue / monthlyData[monthKey].count;
        });
        return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    }

    // Function to create a bar chart using D3.js
    function createBarChart(data, containerId, title, xKey, yKey, color, isLineChart = false) {
        // Get container width and set responsive dimensions
        const container = document.getElementById(containerId);
        
        // Store the original data for filtering
        if (isLineChart) {
            // Only store if not already stored
            if (!window.originalMonthlyData) {
                window.originalMonthlyData = [...data];
            }
        }
        
        // Clear previous SVG only
        const existingSvg = container.querySelector('svg');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Remove existing no-data message if it exists
        const existingMessage = container.querySelector('.no-data-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // If this is the monthly chart and filters don't exist, create them
        if (isLineChart && !container.querySelector('.chart-filter')) {
            const filterContainer = document.createElement('div');
            filterContainer.className = 'chart-filter';
            
            // Get unique years from original data
            const years = [...new Set(window.originalMonthlyData.map(d => d.month.split('-')[0]))].sort();
            
            // Create filter HTML
            filterContainer.innerHTML = `
                <select id="yearFilter" class="form-select">
                    <option value="all">All Years</option>
                    ${years.map(year => 
                        `<option value="${year}">${year}</option>`
                    ).join('')}
                </select>
                <select id="monthFilter" class="form-select">
                    <option value="all">All Months</option>
                    ${['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => 
                        `<option value="${String(index + 1).padStart(2, '0')}">${month}</option>`
                    ).join('')}
                </select>
            `;
            container.insertBefore(filterContainer, container.firstChild);
            
            // Add event listeners
            const yearFilter = document.getElementById('yearFilter');
            const monthFilter = document.getElementById('monthFilter');
            
            yearFilter.addEventListener('change', updateMonthlyChart);
            monthFilter.addEventListener('change', updateMonthlyChart);
        }
        
        const containerWidth = container.clientWidth;
        const margin = { top: 40, right: 30, bottom: 40, left: 60 };
        const width = containerWidth - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(`#${containerId}`)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Add title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .style("font-size", "18px")
            .style("font-weight", "bold")
            .style("fill", "#2c3e50")
            .text(title);

        // Create scales
        const x = d3.scaleBand()
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .range([height, 0]);

        // Set domains
        x.domain(data.map(d => d[xKey]));
        y.domain([0, d3.max(data, d => d[yKey])]);

        // Add grid lines
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat("")
            );

        // Add X axis
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        // Add Y axis
        svg.append("g")
            .call(d3.axisLeft(y));

        // Add Y axis label
        svg.append("text")
            .attr("class", "axis-title")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("x", -height / 2)
            .attr("text-anchor", "middle")
            .text(isLineChart ? "Average Price ($)" : "Number of Sales");

        // Add line for monthly data
        if (isLineChart) {
            const line = d3.line()
                .x(d => x(d[xKey]) + x.bandwidth() / 2)
                .y(d => y(d[yKey]))
                .curve(d3.curveMonotoneX);

            svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("d", line);

            // Add dots
            svg.selectAll(".dot")
                .data(data)
                .enter()
                .append("circle")
                .attr("class", "dot")
                .attr("cx", d => x(d[xKey]) + x.bandwidth() / 2)
                .attr("cy", d => y(d[yKey]))
                .attr("r", 5)
                .attr("fill", color)
                .on("mouseover", function(event, d) {
                    d3.select(this)
                        .attr("r", 8)
                        .attr("fill", "#3498db");
                    
                    // Show tooltip
                    const tooltip = d3.select("#tooltip");
                    tooltip.style("opacity", 1)
                        .html(`
                            <strong>${d[xKey]}</strong><br>
                            Average Price: $${d[yKey].toLocaleString()}<br>
                            Total Revenue: $${d.total_revenue.toLocaleString()}<br>
                            Number of Sales: ${d.count}
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .attr("r", 5)
                        .attr("fill", color);
                    d3.select("#tooltip").style("opacity", 0);
                });
        } else {
            // Add bars for company data
            svg.selectAll(".bar")
                .data(data)
                .enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d[xKey]))
                .attr("width", x.bandwidth())
                .attr("y", d => y(d[yKey]))
                .attr("height", d => height - y(d[yKey]))
                .attr("fill", color)
                .on("mouseover", function(event, d) {
                    d3.select(this)
                        .attr("fill", "#2ecc71");
                    
                    // Show tooltip
                    const tooltip = d3.select("#tooltip");
                    tooltip.style("opacity", 1)
                        .html(`
                            <strong>${d[xKey]}</strong><br>
                            Number of Sales: ${d[yKey]}<br>
                            Total Revenue: $${d.total_revenue.toLocaleString()}<br>
                            Average Price: $${(d.total_revenue / d[yKey]).toLocaleString()}
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .attr("fill", color);
                    d3.select("#tooltip").style("opacity", 0);
                });
        }
    }

    // Function to update monthly chart based on filters
    function updateMonthlyChart() {
        const yearFilter = document.getElementById('yearFilter');
        const monthFilter = document.getElementById('monthFilter');
        const selectedYear = yearFilter.value;
        const selectedMonth = monthFilter.value;
        
        // Get the original data
        let filteredData = [...window.originalMonthlyData];
        
        // Apply filters
        if (selectedYear !== 'all') {
            filteredData = filteredData.filter(d => d.month.startsWith(selectedYear));
        }
        
        if (selectedMonth !== 'all') {
            filteredData = filteredData.filter(d => {
                const monthPart = d.month.split('-')[1];
                return monthPart === selectedMonth;
            });
        }

        // If no data after filtering, show a message
        if (filteredData.length === 0) {
            const container = document.getElementById('monthlyChart');
            const existingSvg = container.querySelector('svg');
            if (existingSvg) {
                existingSvg.remove();
            }
            
            // Add a message when no data is available
            const messageDiv = document.createElement('div');
            messageDiv.className = 'no-data-message';
            messageDiv.style.textAlign = 'center';
            messageDiv.style.padding = '2rem';
            messageDiv.style.color = '#666';
            messageDiv.innerHTML = `
                <i class="bi bi-info-circle" style="font-size: 2rem;"></i>
                <p style="margin-top: 1rem;">No data available for the selected filters</p>
            `;
            container.appendChild(messageDiv);
            return;
        }

        // Update the chart with filtered data
        createBarChart(filteredData, 'monthlyChart', 'Average Sale Price Over Time', 'month', 'average_price', '#2196F3', true);
    }

    // Fetch existing tasks when the page loads
    fetchExistingTasks();
}); 