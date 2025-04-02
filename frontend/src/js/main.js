// frontend/src/js/main.js
async function init() {
    const data = await fetchData();
    if (data.length > 0) {
        createBarChart(data);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);


// frontend/src/js/main.js
document.addEventListener('DOMContentLoaded', function() {
    // This function will be called when data is uploaded
    window.createVisualization = function(data) {
        // Clear previous visualization
        d3.select('#visualization').html('');
        
        // Check if data is an array
        if (!Array.isArray(data)) {
            console.error('Data must be an array');
            return;
        }
        
        // Basic check to determine if the data might be suitable for a bar chart
        const firstItem = data[0];
        const keys = Object.keys(firstItem);
        
        // Look for potential category and value fields
        let categoryField = null;
        let valueField = null;
        
        for (const key of keys) {
            const value = firstItem[key];
            if (typeof value === 'string') {
                categoryField = categoryField || key;
            } else if (typeof value === 'number') {
                valueField = valueField || key;
            }
        }
        
        if (categoryField && valueField) {
            createBarChart(data, categoryField, valueField);
        } else {
            // Display message if data structure is unclear
            d3.select('#visualization')
                .append('div')
                .attr('class', 'error')
                .text('Unable to determine how to visualize this data structure. Please ensure your data has both category (string) and value (number) fields.');
        }
    };
    
    function createBarChart(data, categoryField, valueField) {
        // Set the dimensions and margins of the graph
        const margin = {top: 30, right: 30, bottom: 70, left: 60},
            width = 800 - margin.left - margin.right,
            height = 400 - margin.top - margin.bottom;
        
        // Append the svg object to the body of the page
        const svg = d3.select('#visualization')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // X axis
        const x = d3.scaleBand()
            .range([0, width])
            .domain(data.map(d => d[categoryField]))
            .padding(0.2);
        
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'translate(-10,0)rotate(-45)')
            .style('text-anchor', 'end');
        
        // Find the maximum value for the y axis
        const maxValue = d3.max(data, d => d[valueField]);
        
        // Y axis
        const y = d3.scaleLinear()
            .domain([0, maxValue * 1.1]) // Add 10% padding
            .range([height, 0]);
        
        svg.append('g')
            .call(d3.axisLeft(y));
        
        // Create a tooltip div
        const tooltip = d3.select('body')
            .append('div')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('pointer-events', 'none');
        
        // Bars
        svg.selectAll('mybar')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', d => x(d[categoryField]))
            .attr('y', d => y(d[valueField]))
            .attr('width', x.bandwidth())
            .attr('height', d => height - y(d[valueField]))
            .attr('fill', '#3498db')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('fill', '#2980b9');
                tooltip
                    .style('visibility', 'visible')
                    .html(`${categoryField}: ${d[categoryField]}<br>${valueField}: ${d[valueField]}`);
            })
            .on('mousemove', function(event) {
                tooltip
                    .style('top', (event.pageY - 10) + 'px')
                    .style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('fill', '#3498db');
                tooltip.style('visibility', 'hidden');
            });
        
        // Add title
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', 0 - (margin.top / 2))
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .text(`${categoryField} vs ${valueField}`);
    }
});