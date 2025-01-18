async function fetchObservations() {
    try {
        const response = await fetch('http://localhost:3000/observations.json'); // رابط ملف JSON
        if (response.ok) {
            const data = await response.json();
            updateChart(data);
        } else {
            console.error('Failed to fetch observations.');
        }
    } catch (error) {
        console.error('Error fetching observations:', error);
    }
}

function updateChart(data) {
    const chartContainer = d3.select("#chart-container");
    chartContainer.selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = chartContainer
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, data.length]).range([0, width]);
    const y = d3.scaleLinear()
        .domain([
            d3.min(data, d => d.valueQuantity.value),
            d3.max(data, d => d.valueQuantity.value),
        ])
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g").call(d3.axisLeft(y));

    const line = d3.line()
        .x((_, i) => x(i))
        .y(d => y(d.valueQuantity.value));

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line);
}

// استدعاء البيانات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', fetchObservations);
