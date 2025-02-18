// custom udfs for following. Change here if required
const platformUdf = "udf_platform";
const caseNumUdf = "udf_case_number";
const caseIdUdf = "udf_case_id";
const releaseNumUdf = "udf_release_number";
const projCodeUdf = "udf_project_code";

const RESNAME = "resName"
const RESID = "resId"
const RESTYPE = "resType"
const ROLES = "roles"
const PRIMARYROLE = "primaryRole"
const PROJNAME = "projName"
const PROJTYPE = "projType"
const PLATFORM = "platform"
const CASENUM = "caseNumber"
const CASEID = "caseId"
const PROJCODE = "projCode"
const RELNUM = "releaseNumber"
const headerSequenceMap = ["Resource", "Resource Id", "Resource Type", "Roles", "Primary Role", "Project", "Project Type", "Platform", "Case Number", "Case Id", "Project Code", "Release Number"];

let roles = {};
let resourceTypes = {};

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
    let mainRow = "";
    sortedHeaders.forEach((header, id) => {
        const frontValue = headerSequenceMap[id] || header;
        if (sortedHeaders.length - 1 === id) {
            mainRow += `${frontValue}`;
            return;
        }
        mainRow += `${frontValue},`;
    })
    rows.push(mainRow);

    // Generate rows based on data
    for (const resourceId in data) {
        const resource = data[resourceId];
        const resData = resource.data;

        for (const projectId in resource) {
            if (projectId === "data") continue;
            const project = resource[projectId];
            const projData = resource[projectId].data;

            const currRoles = [];
            const renamingRoles = resData[ROLES];
            renamingRoles.forEach(role => {
                currRoles.push(roles[role] || role);
            })
            const currPrimRole = roles[renamingRoles[0]] || renamingRoles[0];
            const row = [resData[RESNAME], resData[RESID], resData[RESTYPE], `${currRoles.join("; ")}`, currPrimRole, projData[PROJNAME], projData[PROJTYPE], projData[PLATFORM], projData[CASENUM], projData[CASEID], projData[PROJCODE], projData[RELNUM]];

            // Fill in data for each month
            for (let i = 12; i < sortedHeaders.length; i++) {
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
    const tempHeader = [RESNAME, RESID, RESTYPE, ROLES, PRIMARYROLE, PROJNAME, PROJTYPE, PLATFORM, CASENUM, CASEID, PROJCODE, RELNUM];

    while (start <= end) {
        const month = start.toLocaleString('default', { month: 'short' });
        const year = start.getFullYear().toString().slice(-2); // Short year format
        tempHeader.push(`${year}-${month}`); // Add month-year in desired format
        start.setDate(1); // Reset date to 1 to avoid month carryover issues
        start.setMonth(start.getMonth() + 1); // Move to the next month
    }

    return tempHeader; // This will be in chronological order
}

const generateJSON = async (data, projects) => {

    // Generating project ID-name map
    const project_id_map = {};
    projects.forEach(project => {
        project_id_map[project.id] = project;
    });

    // Date handling
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const headers = getHeaders(start, end);
    const utilization = {};

    for (let resource = 0; resource < data.resources.length; resource++) {
        const currentResource = data.resources[resource];
        const currRes = currentResource.data;
        const resourceId = currentResource.data.id;
        const resourceName = currentResource.data.name;
        const resourceUtil = currentResource.dailyUtilization;

        // Initialize resource object if not already present
        if (!utilization[resourceId]) {
            utilization[resourceId] = { data: {} };
        }
        const resource_obj = utilization[resourceId];
        const resource_obj_data = utilization[resourceId].data;
        resource_obj_data[RESNAME] = resourceName;
        resource_obj_data[RESID] = resourceId;
        resource_obj_data[RESTYPE] = resourceTypes[currRes.resource_type_id];
        resource_obj_data[ROLES] = currRes.roles || ["NA"];
        resource_obj_data[PRIMARYROLE] = resource_obj_data[ROLES][0];
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
                const currProj = project_id_map[project_id];

                // Initialize project object if not already present
                if (!resource_obj[project_id]) {
                    resource_obj[project_id] = { data: {} };
                }
                const project_obj = resource_obj[project_id];
                const project_obj_data = resource_obj[project_id].data;
                project_obj_data[PROJNAME] = currProj.title;
                project_obj_data[PROJTYPE] = currProj.project_type_id;
                project_obj_data[PLATFORM] = currProj[platformUdf] || "NA";
                project_obj_data[CASENUM] = currProj[caseNumUdf] || "NA";
                project_obj_data[CASEID] = currProj[caseIdUdf] || "NA";
                project_obj_data[PROJCODE] = currProj[projCodeUdf] || "NA";
                project_obj_data[RELNUM] = currProj[releaseNumUdf] || "NA";

                // Generating date format
                const month = trackingDate.toLocaleString('default', { month: 'short' });
                const year = trackingDate.getFullYear().toString().slice(-2);
                const dateFormat = `${year}-${month}`;

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
    const resourceTypeArray = data.resourceTypes;
    const projects = data.projects;
    const rolesArray = data.roles && data.roles.data || {};
    roles = {};
    rolesArray.forEach(role => {
        roles[role.id] = role.name;
    })
    resourceTypes = {};
    resourceTypeArray.forEach(resourceType => {
        resourceTypes[resourceType.id] = resourceType.name;
    })

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