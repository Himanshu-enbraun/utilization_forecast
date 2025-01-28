const displayCSV = (csvData) => {
    const rows = csvData.split('\n'); // Split data by newlines
    const table = document.getElementById('csvTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // Clear existing table content
    thead.innerHTML = '';
    tbody.innerHTML = '';

    rows.forEach((row, index) => {
        const cells = row.split(','); // Split row into columns
        const tr = document.createElement('tr');
        cells.forEach(cell => {
            const td = document.createElement(index === 0 ? 'th' : 'td');
            td.textContent = cell.trim();
            tr.appendChild(td);
        });
        if (index === 0) {
            thead.appendChild(tr); // Add header row to <thead>
        } else {
            tbody.appendChild(tr); // Add data rows to <tbody>
        }
    });
    document.getElementById("skeletonLoader").style.display = "none";
    table.style.display = "block";
}

function convertToCSV(data, sortedHeaders) {
    const rows = [];

    // Add headers to rows
    rows.push(sortedHeaders.join(","));

    // Generate rows based on data
    for (const resourceId in data) {
        const resource = data[resourceId];
        const resourceName = resource.name;

        for (const projectId in resource) {
            if (projectId === "name") continue;
            const project = resource[projectId];
            const projectName = project.name;

            const row = [resourceName, projectName];

            // Fill in data for each month
            for (let i = 2; i < sortedHeaders.length; i++) {
                const month = sortedHeaders[i];
                const value = project[month] || 0; // Default to 0 if no data for the month

                // Format value to 2 decimal places and remove trailing zeros
                const formattedValue = Number(value).toFixed(2).replace(/\.?0+$/, "");

                row.push(formattedValue);
            }

            rows.push(row.join(","));
        }
    }

    // Combine rows into a CSV string
    return rows.join("\n");
}


function getHeaders(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = ["Resource", "Project"];

    while (start <= end) {
        const month = start.toLocaleString('default', { month: 'short' });
        const year = start.getFullYear().toString().slice(-2); // Short year format
        months.push(`${month}-${year}`); // Add month-year in desired format
        start.setDate(1); // Reset date to 1 to avoid month carryover issues
        start.setMonth(start.getMonth() + 1); // Move to the next month
    }

    return months; // This will be in chronological order
}

const generateJSON = async (data, projects) => {

    // Generating project ID-name map
    const project_id_name_map = {};
    projects.forEach(project => {
        project_id_name_map[project.id] = project.title;
    });

    // Date handling
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const headers = getHeaders(start, end);

    const utilization = {};

    for (let resource = 0; resource < data.resources.length; resource++) {
        const currentResource = data.resources[resource];
        const resourceId = currentResource.data.id;
        const resourceName = currentResource.data.name;
        const resourceUtil = currentResource.dailyUtilization;

        // Initialize resource object if not already present
        if (!utilization[resourceId]) {
            utilization[resourceId] = { name: resourceName };
        }
        const resource_obj = utilization[resourceId];
        let trackingDate = new Date(start);

        for (let utilizationIndex = 0; utilizationIndex < resourceUtil.length; utilizationIndex++) {
            const currentUtil = resourceUtil[utilizationIndex];
            const utilBookings = currentUtil[1];
            if (utilBookings.length === 0) {
                trackingDate.setDate(trackingDate.getDate() + 1);
                continue;
            };

            for (let booking = 0; booking < utilBookings.length; booking++) {
                const currentBooking = utilBookings[booking];
                const project_id = currentBooking[2];
                const project_name = project_id_name_map[currentBooking[2]];

                // Initialize project object if not already present
                if (!resource_obj[project_id]) {
                    resource_obj[project_id] = { name: project_name };
                }
                const project_obj = resource_obj[project_id];

                // Generating date format
                const month = trackingDate.toLocaleString('default', { month: 'short' });
                const year = trackingDate.getFullYear().toString().slice(-2);
                const dateFormat = `${month}-${year}`;

                project_obj[dateFormat] = (project_obj[dateFormat] || 0) + currentBooking[0];
            }

            // Increment the date by 1 day
            trackingDate.setDate(trackingDate.getDate() + 1);
        }
    }
    const convertedCSV = convertToCSV(utilization, headers);
    downloadExistingCSV(convertedCSV);
    displayCSV(convertedCSV);
};

// Handling form submission
const handleSubmit = async (e) => {
    e.preventDefault();
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("csvTable").style.display = "none";
    document.getElementById("skeletonLoader").style.display = "block";
    const formData = new FormData(e.target);
    const startDate = formData.get("start_date");
    const endDate = formData.get("end_date");

    const data = await fetch(`/getUtilization?start=${startDate}&end=${endDate}`, {
        method: 'GET'
    }).then(res => res.json()).then(res => res);
    
    const util = data.utilisation;
    const projects = data.projects;

    generateJSON(util, projects);
}

// Export table data to CSV
function downloadExistingCSV(csvContent) {
    // Enable the button
    const exportButton = document.getElementById("exportButton");
    exportButton.disabled = false;

    // Add event listener to the button
    exportButton.addEventListener("click", () => {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "report.csv";
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, { once: true }); // Ensures the event listener is executed only once
}