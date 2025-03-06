const forecastJS = require("./forecast_back.js");
const utilizationJS = require("./utilization_back.js");

// Mapping short metric codes to their full names
const metricsMap = {
    "C": "Capacity",
    "S": "Scheduled",
    "A": "Actual",
    "B": "Balance",
    "PR": "Pending Request"
};

/*
    * Generating redable time string
*/
function getReadableTimestamp() {
    const now = new Date();

    const date = now.getDate().toString().padStart(2, "0"); // 01-31
    const month = now.toLocaleString("default", { month: "long" }); // January-December
    const year = now.getFullYear(); // 2025
    const hours = now.getHours().toString().padStart(2, "0"); // 00-23
    const minutes = now.getMinutes().toString().padStart(2, "0"); // 00-59
    const seconds = now.getSeconds().toString().padStart(2, "0"); // 00-59
    const ampm = hours >= 12 ? "PM" : "AM"; // AM/PM

    return `${date}-${month}-${year}_${hours}:${minutes}:${seconds}_${ampm}`;
}

/**
 * Fetches configuration settings from the server and generates forecast & utilization data.
 * @returns {Promise<{forecast: Object, utilization: Object}>} The generated forecast and utilization data.
 */
const generateData = async (env) => {
    try {
        // Extract configurations from the fetched data
        const dateRange = env.DATE_RANGE; // Expected format: "X,Y" (relative years)
        const BalData = env.BALANCE_DATA;
        const PRData = env.PR_CALC_METHOD;
        const forecastMetrics = env.FORECAST_METRICS;
        const LinkedBookingsOnly = JSON.parse(env.LINKED_BOOKINGS_ONLY);

        // Determine the start and end years based on date range offsets
        const currentYear = new Date().getFullYear();
        const [startOffset, endOffset] = dateRange.split(',').map(Number);
        const startYear = currentYear + startOffset;
        const endYear = currentYear + endOffset;

        // Construct start and end dates
        const startDate = `${startYear}-01-01`;
        const endDate = `${endYear}-12-31`;

        // Convert forecast metrics into readable format
        const checkboxes = forecastMetrics.split(',').map(metric => metricsMap[metric]);

        // Fetch utilization and forecast data from respective APIs
        const forecastData = { startDate, endDate, checkboxes, PRData, BalData, LinkedBookingsOnly, env }
        const forecast = await forecastJS.sendDataRequest(forecastData);
        const utilization = await utilizationJS.sendDataRequest(startDate, endDate, env);

        return { forecast, utilization };
    } catch (error) {
        console.error("Error generating data:", error);
        return { forecast: null, utilization: null };
    }
};

/**
 * Main function to generate data and send forecast & utilization reports via email.
 */
const main = async (env_config) => {
    const { forecast, utilization } = await generateData(env_config);

    if (forecast && utilization) {
        const forecastEmail = {
            subject: "Eresourcescheduler Data for Capacity Forecast",
            csvData: forecast,
            csvFileName: `Capacity Forecast Report ${getReadableTimestamp()}.csv`
        }

        const utilizationEmail = {
            subject: "Eresourcescheduler Data for Utilization",
            csvData: utilization,
            csvFileName: `Utilization Report ${getReadableTimestamp()}.csv`
        }
        return { forecastEmail, utilizationEmail };
    } else {
        console.error("Failed to generate forecast or utilization data.");
        return {};
    }
};

module.exports = {
    main
}