const axios = require("axios")

/*
    * Variables used throughout multiple files
*/
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

/*
    * Generating CSV data using Re-formed CSV
*/
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
            // initial number of loop is the length of header
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

/*
    * Generating headers for csv
    * Generated headers contain all the months which is set by user
*/
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

/*  
    * Reforming JSON data to make CSV data
*/
const generateJSON = async (data, projects, getUtilizationEnvConfig) => {

    const { platformUdf, caseNumUdf, caseIdUdf, releaseNumUdf, projCodeUdf } = getUtilizationEnvConfig;

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

    for (let resource = 0; resource < data.resources.length; resource++) {  // Looping on all resources of current utilization
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

        for (let utilizationIndex = 0; utilizationIndex < resourceUtil.length; utilizationIndex++) {    // Looping on all bookings of current resource
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
                // Setting up value for respective headings
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

                // Setting booking of current date on a project of a resource
                project_obj[dateFormat] = (project_obj[dateFormat] || 0) + currentBooking[0];
            }

            // Marking iterated to skip in next loop
            trackingDate.setDate(trackingDate.getDate() + 1);
        }
    }
    const convertedCSV = convertToCSV(utilization, headers); // Generating CSV using reformed data
    return convertedCSV;
};

const sendDataRequest = async (startDate, endDate, env) => {
    try {
        // Fetch data using axios
        const [rolesResponse, utilizationResponse, projectsResponse, resourceTypesResponse] = await Promise.all([
            axios.get(`${env.ERS_API_DOMAIN}/rest/roles`, {
                headers: { Authorization: `Bearer ${env.ERS_TOKEN}` }
            }),
            axios.get(`${env.ERS_API_DOMAIN}/rest/utilization`, {
                params: { start: startDate, end: endDate },
                headers: { Authorization: `Bearer ${env.ERS_TOKEN}` }
            }),
            axios.get(`${env.ERS_API_DOMAIN}/rest/utilization/projects-data`, {
                headers: { Authorization: `Bearer ${env.ERS_TOKEN}` }
            }),
            axios.get(`${env.ERS_API_DOMAIN}/rest/resourcetype`, {
                headers: { Authorization: `Bearer ${env.ERS_TOKEN}` }
            })
        ]);

        // Extract data from responses
        const util = utilizationResponse.data;
        const projects = projectsResponse.data.data;
        const resourceTypeArray = resourceTypesResponse.data.data;
        const rolesArray = rolesResponse.data?.data || [];

        // Map roles and resource types
        roles = {};
        rolesArray.forEach(role => {
            roles[role.id] = role.name;
        });

        resourceTypes = {};
        resourceTypeArray.forEach(resourceType => {
            resourceTypes[resourceType.id] = resourceType.name;
        });

        const getUtilizationEnvConfig = {
            platformUdf: env.PLATFORM_UDF,
            caseNumUdf: env.CASE_NUM_UDF,
            caseIdUdf: env.CASE_ID_UDF,
            releaseNumUdf: env.RELEASE_NUM_UDF,
            projCodeUdf: env.PROJ_CODE_UDF
        };

        // Generating CSV data
        return generateJSON(util, projects, getUtilizationEnvConfig);
    } catch (error) {
        console.error("Error fetching utilization data:", error.message);
        throw new Error("Failed to fetch utilization and related data");
    }
};

module.exports = {
    sendDataRequest
}