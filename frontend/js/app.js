document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const loadingSpinner = document.getElementById('loading-spinner');
    const averageOutput = document.getElementById('average-output');

    if (!fileInput.files.length) {
        alert('Please select a file!');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    loadingSpinner.style.display = 'block';
    averageOutput.textContent = '';

    const BACKEND_URL =
        window.BACKEND_URL || window.location.origin.replace('5500', '3000');

    try {
        const response = await fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();

            // Calculate the average value from observations
            const average = data.reduce((sum, obs) => sum + obs.valueQuantity.value, 0) / data.length;
            averageOutput.textContent = `Average Value: ${average.toFixed(2)} mV`;

            // Update chart with new data
            updateChart(data);
        } else {
            alert('Failed to process file.');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
    } finally {
        loadingSpinner.style.display = 'none';
    }
});

// Chart function
function updateChart(data) {
    const chartContainer = d3.select('#chart-container');
    chartContainer.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = chartContainer
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, data.length]).range([0, width]);
    const y = d3.scaleLinear()
        .domain([d3.min(data, (d) => d.valueQuantity.value), d3.max(data, (d) => d.valueQuantity.value)])
        .range([height, 0]);

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append('g').call(d3.axisLeft(y));

    const line = d3.line()
        .x((_, i) => x(i))
        .y((d) => y(d.valueQuantity.value));

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);
}
