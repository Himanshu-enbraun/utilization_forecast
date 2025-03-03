let rolesMap = {};

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
        if (!cells[cells.length - 1]) {
            cells.pop();
        }
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

// Helper function to format numbers
function formatNumber(value) {
    return value % 1 === 0 ? value : value.toFixed(2);
}
const generateCSV = (headers, data, prData) => {
    let csv = "";
    if (headers[0].length !== headers[1].length) {
        alert("Headers length must be samef");
        return;
    }
    csv += headers[0].join(","); // Building first header
    csv += "\n";
    csv += headers[1].join(","); // Building second header
    csv += "\n";

    const keys = Object.keys(data);
    keys.sort((a, b) => {
        if (a === 'Total') return -1; // "Total" comes first
        if (b === 'Total') return 1;
        if (a === 'Role Undefined') return 1; // "Role Undefined" comes last
        if (b === 'Role Undefined') return -1;

        // Sort the rest numerically (convert strings to numbers for correct order)
        return Number(a) - Number(b);
    });
    keys.forEach(role => {
        // if (!prData[role] && role !== "Total" && role !== "Role Undefined") {
        //     return;
        // }
        const currentRole = data[role];
        for (let i = 0; i < headers[0].length; i++) {
            const headP = headers[0][i];
            const headC = headers[1][i];

            // first column value;
            if (headP === "Primary Role" && headC === "Unit") {
                csv += `${rolesMap[role] || role},`;
            } else {
                const valueToAdd = currentRole[headC] && currentRole[headC][headP] || 0;
                csv += `${formatNumber(valueToAdd)},`;
            }
        }
        csv += "\n";
    })
    return csv;
}

const selectedUnits = {
    "Capacity": false, "Scheduled": false, "Pending-Request": false, "Balance": false, "Actual": false
};

function getHeaders(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const headers = [
        ["Primary Role"],
        ["Unit"]
    ];
    const units = ["Capacity", "Scheduled", "Actual", "Pending-Request", "Balance"];

    // Add "Total" headers once for all selected units. Uncomment this to add total
    // units.forEach(unit => {
    //     if (selectedUnits[unit]) {
    //         headers[0].push("Total");
    //         headers[1].push(unit);
    //     }
    // });

    // Add month-year headers for each selected unit
    while (start <= end) {
        const month = start.toLocaleString('default', { month: 'short' });
        const year = start.getFullYear().toString().slice(-2); // Short year format
        units.forEach(unit => {
            if (selectedUnits[unit]) {
                headers[0].push(`${year}-${month}`);
                headers[1].push(unit);
            }
        });
        start.setDate(1); // Reset date to 1 to avoid month carryover issues
        start.setMonth(start.getMonth() + 1); // Move to the next month
    }

    return headers; // This will be in chronological order
}

const getBalance = (condition, cap, util, actual, PR) => {
    switch (condition) {
        case "a":
            return cap - util;
        case "b":
            return cap - actual;
        case "c":
            return cap - util - PR;
        case "d":
            return cap - actual - PR;
        default:
            return 0;
    }
}

const generatePRData = (utilization, pendingReqCalculationMethod) => {
    const projects = utilization.projects || [];
    const resources = utilization.resources || [];
    const defaultDailyRequirement = [];
    const defaultdailyCapacity = [];
    const roleRequirementmap = {};
    const projectIds = [];

    if (resources.length > 0) {
        for (const j in resources[0].dailyCapacity) {
            defaultDailyRequirement.push([0, []]);
            defaultdailyCapacity.push(0);
        }
    } else if (projects.length > 0) {
        for (const j in projects[0].dailyRequirement) {
            defaultDailyRequirement.push([0, []]);
            defaultdailyCapacity.push(0);
        }
    }

    projects.forEach((pro) => {
        projectIds.push(pro.id);
        pro.dailyRequirement.forEach((proReq, id) => {
            if (proReq[1]) {
                proReq[1].forEach((reqDetail) => {
                    let defReq;
                    if (reqDetail[4]) {
                        defReq = roleRequirementmap[reqDetail[4]] || JSON.parse(JSON.stringify(defaultDailyRequirement));
                        defReq[id][0] += reqDetail[0];
                        defReq[id][1].push(reqDetail);
                        roleRequirementmap[reqDetail[4]] = defReq;
                    } else {
                        defReq = roleRequirementmap[-1] || JSON.parse(JSON.stringify(defaultDailyRequirement));
                        defReq[id][0] += reqDetail[0];
                        defReq[id][1].push(reqDetail);
                        roleRequirementmap[-1] = defReq;
                    }
                });
            }
        });
    });

    const roleUtilizationMap = {};
    if (pendingReqCalculationMethod === 'a') {
        projects.forEach((pro) => {
            pro.dailyUtilization.forEach((util, id) => {
                if (util[1]) {
                    util[1].forEach((proUtil) => {
                        let defUtil;
                        if (proUtil[4]) {
                            defUtil = roleUtilizationMap[proUtil[4]] || JSON.parse(JSON.stringify(defaultDailyRequirement));
                            defUtil[id][0] += proUtil[0];
                            defUtil[id][1].push(proUtil);
                            roleUtilizationMap[proUtil[4]] = defUtil;
                        } else {
                            defUtil = roleUtilizationMap[-1] || JSON.parse(JSON.stringify(defaultDailyRequirement));
                            defUtil[id][0] += proUtil[0];
                            defUtil[id][1].push(proUtil);
                            roleUtilizationMap[-1] = defUtil;
                        }
                    });
                }
            });
        });
    } else if (pendingReqCalculationMethod === 'b' && projectIds.length > 0) {
        resources.forEach((res) => {
            res.dailyActualUtilization.forEach((actual, id) => {
                if (actual[1]) {
                    actual[1].forEach((proActualUtil) => {
                        if (projectIds.includes(proActualUtil[2])) {
                            let defActualUtil;
                            if (proActualUtil[4]) {
                                defActualUtil = roleUtilizationMap[proActualUtil[4]] || JSON.parse(JSON.stringify(defaultDailyRequirement));
                                defActualUtil[id][0] += proActualUtil[0];
                                defActualUtil[id][1].push(proActualUtil);
                                roleUtilizationMap[proActualUtil[4]] = defActualUtil;
                            } else {
                                defActualUtil = roleUtilizationMap[-1] || JSON.parse(JSON.stringify(defaultDailyRequirement));
                                defActualUtil[id][0] += proActualUtil[0];
                                defActualUtil[id][1].push(proActualUtil);
                                roleUtilizationMap[-1] = defActualUtil;
                            }
                        }
                    });
                }
            });
        });
    }

    Object.keys(roleUtilizationMap).forEach((key) => {
        if (!roleRequirementmap[key]) {
            roleRequirementmap[key] = JSON.parse(JSON.stringify(defaultDailyRequirement));
        }
        roleRequirementmap[key].forEach((req, id) => {
            roleRequirementmap[key][id][0] -= roleUtilizationMap[key][id][0];
        });
    });

    const enteredRole = [];
    resources.forEach((res, i) => {
        const resRole = res.data.roles ? res.data.roles[0] : -1;
        res.dailyRequirement = defaultDailyRequirement;
        if (roleRequirementmap[resRole] && !enteredRole.includes(resRole)) {
            res.dailyRequirement = roleRequirementmap[resRole];
            enteredRole.push(resRole);
        }
    });

    Object.keys(roleRequirementmap).forEach((key) => {
        let i = 0;
        if (!enteredRole.includes(Number(key))) {
            resources.push({
                dailyRequirement: roleRequirementmap[key],
                dailyUtilization: defaultDailyRequirement,
                dailyCapacity: defaultdailyCapacity,
                dailyActualUtilization: defaultDailyRequirement,
                id: i--,
                data: { roles: key == -1 ? [] : [Number(key)] }
            });
            enteredRole.push(Number(key));
        }
    });
    return roleRequirementmap;
};

const generateJSON = async (data, PRSelection = 'a', BalanceSelection = 'b') => {
    const { resources, totalCapacity, totalUtilization, totalActualUtilization } = data;

    const prData = generatePRData(data, PRSelection);

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    const headers = getHeaders(start, end);
    const forecast = { Total: {} };

    for (let resource = 0; resource < resources.length; resource++) { // Looping on all resources
        const currentResource = resources[resource];
        const { dailyUtilization, dailyActualUtilization, dailyCapacity } = currentResource;
        const roles = (currentResource.data && currentResource.data.roles) || ["Role Undefined"];

        for (let role = 0; role < roles.length; role++) { // Looping on all roles of current resource
            const currentRole = roles[role];

            const dateRange = dailyCapacity.length;
            const trackingDate = new Date(start);

            if (!forecast[currentRole]) {
                forecast[currentRole] = { name: rolesMap[currentRole] };
            }
            const roleObj = forecast[currentRole];

            for (let dateIndex = 0; dateIndex < dateRange; dateIndex++) { // Looping on data given in format of dates from start to end
                const currentCap = role === 0 ? dailyCapacity[dateIndex] : 0;
                const currentActUtil = role === 0 ? dailyActualUtilization[dateIndex][0] : 0;
                const currentUtil = role === 0 ? dailyUtilization[dateIndex][0] : 0;
                let PR;
                if (currentRole === "Role Undefined") {
                    PR = prData[-1] && prData[-1][dateIndex] && prData[-1][dateIndex][0] || 0;
                } else if (prData[currentRole]) {
                    PR = prData[currentRole][dateIndex] && prData[currentRole][dateIndex][0] || 0;
                } else {
                    PR = 0;
                }

                // Generating date format
                const month = trackingDate.toLocaleString('default', { month: 'short' });
                const year = trackingDate.getFullYear().toString().slice(-2);
                const dateFormat = `${year}-${month}`;
                const date = trackingDate.getDate();

                // Column Total
                if (resource === 0) {
                    if (selectedUnits["Capacity"]) {
                        if (!forecast.Total["Capacity"]) {
                            forecast.Total["Capacity"] = { Total: 0 };
                        }
                        forecast.Total["Capacity"].Total += totalCapacity[dateIndex];
                        forecast.Total.Capacity[dateFormat] = (forecast.Total.Capacity[dateFormat] || 0) + totalCapacity[dateIndex];
                    }
                    if (selectedUnits["Scheduled"]) {
                        if (!forecast.Total["Scheduled"]) {
                            forecast.Total["Scheduled"] = { Total: 0 };
                        }
                        forecast.Total["Scheduled"].Total += totalUtilization[dateIndex];
                        forecast.Total.Scheduled[dateFormat] = (forecast.Total.Scheduled[dateFormat] || 0) + totalUtilization[dateIndex];
                    }
                    if (selectedUnits["Actual"]) {
                        if (!forecast.Total["Actual"]) {
                            forecast.Total["Actual"] = { Total: 0 };
                        }
                        forecast.Total["Actual"].Total += totalActualUtilization[dateIndex];
                        forecast.Total.Actual[dateFormat] = (forecast.Total.Actual[dateFormat] || 0) + totalActualUtilization[dateIndex];
                    }
                }

                // Row calculation WRT roles
                if (selectedUnits["Capacity"]) { // using role === 0 to add primary roles data only
                    if (!roleObj["Capacity"]) {
                        roleObj["Capacity"] = { Total: 0 };
                    }
                    const capObj = roleObj["Capacity"];
                    capObj[dateFormat] = (capObj[dateFormat] || 0) + currentCap;
                    capObj["Total"] += currentCap; // Row Total unit wise
                }
                if (selectedUnits["Scheduled"]) { // using role === 0 to add primary roles data only
                    if (!roleObj["Scheduled"]) {
                        roleObj["Scheduled"] = { Total: 0 };
                    }
                    const scheObj = roleObj["Scheduled"];
                    scheObj[dateFormat] = (scheObj[dateFormat] || 0) + currentUtil;
                    scheObj["Total"] += currentUtil; // Row Total unit wise
                }
                if (selectedUnits["Actual"]) { // using role === 0 to add primary roles data only
                    if (!roleObj["Actual"]) {
                        roleObj["Actual"] = { Total: 0 };
                    }
                    const actObj = roleObj["Actual"];
                    actObj[dateFormat] = (actObj[dateFormat] || 0) + currentActUtil;
                    actObj["Total"] += currentActUtil; // Row Total unit wise
                }
                const prIterated = () => {
                    if (prData[currentRole]) {
                        if (prData[currentRole].includes("iterated")) {
                            return true;
                        }
                        return false;
                    } else if (prData[-1]) {
                        if (prData[-1].includes("iterated")) {
                            return true;
                        }
                        return false;
                    }
                    return false;
                }
                if (selectedUnits["Pending-Request"] && !prIterated()) {
                    if (!roleObj["Pending-Request"]) {
                        roleObj["Pending-Request"] = { Total: 0 };
                    }
                    const prObj = roleObj["Pending-Request"];
                    prObj[dateFormat] = (prObj[dateFormat] || 0) + PR;
                    prObj["Total"] += PR; // Row Total unit wise

                    if (!forecast.Total["Pending-Request"]) {
                        forecast.Total["Pending-Request"] = { Total: 0 };
                    }
                    forecast.Total["Pending-Request"].Total += PR;
                    forecast.Total["Pending-Request"][dateFormat] = (forecast.Total["Pending-Request"][dateFormat] || 0) + PR;
                }
                if (selectedUnits["Balance"]) { // using role === 0 to add primary roles data only
                    if (!roleObj["Balance"]) {
                        roleObj["Balance"] = { Total: 0 };
                    }
                    const balObj = roleObj["Balance"];
                    const balance = getBalance(BalanceSelection, currentCap, currentUtil, currentActUtil, !prIterated() ? PR : 0);
                    balObj[dateFormat] = (balObj[dateFormat] || 0) + balance;
                    balObj["Total"] += balance; // Row Total unit wise

                    if (!forecast.Total["Balance"]) {
                        forecast.Total["Balance"] = { Total: 0 };
                    }
                    forecast.Total["Balance"].Total += balance;
                    forecast.Total.Balance[dateFormat] = (forecast.Total.Balance[dateFormat] || 0) + balance;
                }

                trackingDate.setDate(trackingDate.getDate() + 1);
            }
            // marking iterated to skip in next loop
            currentRole === "Role Undefined" ? prData[-1] && !prData[-1].includes("iterated") && prData[-1].push("iterated") : prData[currentRole] && !prData[currentRole].includes("iterated") && prData[currentRole].push("iterated");
        }
    }
    const createdCSV = generateCSV(headers, forecast, prData);
    downloadExistingCSV(createdCSV);
    displayCSV(createdCSV);
}

// Handling form submission
const handleSubmit = async (e) => {
    e.preventDefault();
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("csvTable").style.display = "none";
    document.getElementById("skeletonLoader").style.display = "block";
    const formData = new FormData(e.target);
    const startDate = formData.get("start_date");
    const endDate = formData.get("end_date");
    const PRData = formData.get("pr_data");
    const BalData = formData.get("balance_data");
    const LinkedBookingsOnly = formData.get("all_linkedBookings");

    for (const key in selectedUnits) {
        selectedUnits[key] = false;
    }

    const checkboxes = formData.getAll("units");
    checkboxes.forEach(box => {
        selectedUnits[box] = true
    })

    const data = await fetch(`/getForecast?start=${startDate}&end=${endDate}&linkedBookingsOnly=${LinkedBookingsOnly}`, {
        method: 'GET'
    }).then(res => res.json()).then(res => res);
    const forecast = data.forecast;
    const rolesArray = data.roles && data.roles.data || {};
    rolesMap = {};
    rolesArray.forEach(role => {
        rolesMap[role.id] = role.name;
    })
    generateJSON(forecast, PRData, BalData);
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