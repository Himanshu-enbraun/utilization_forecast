// Mapping short metric codes to their full names
const metricsMap = {
    "C": "Capacity",
    "S": "Scheduled",
    "A": "Actual",
    "B": "Balance",
    "PR": "Pending Request"
};

/**
 * Fetches configuration settings from the server and generates forecast & utilization data.
 * @returns {Promise<{forecast: Object, utilization: Object}>} The generated forecast and utilization data.
 */
const generateData = async () => {
    try {
        // Fetch environment configurations
        const response = await fetch("/env_config");
        const config = await response.json();

        // Extract configurations from the fetched data
        const dateRange = config.DATE_RANGE; // Expected format: "X,Y" (relative years)
        const balanceData = config.BALANCE_DATA;
        const prCalcMethod = config.PR_CALC_METHOD;
        const forecastMetrics = config.FORECAST_METRICS;
        const linkedBookings = JSON.parse(config.LINKED_BOOKINGS_ONLY);

        // Determine the start and end years based on date range offsets
        const currentYear = new Date().getFullYear();
        const [startOffset, endOffset] = dateRange.split(',').map(Number);
        const startYear = currentYear + startOffset;
        const endYear = currentYear + endOffset;

        // Construct start and end dates
        const startDate = `${startYear}-01-01`;
        const endDate = `${endYear}-12-31`;

        // Convert forecast metrics into readable format
        const metricsConfig = forecastMetrics.split(',').map(metric => metricsMap[metric]);

        // Fetch utilization and forecast data from respective APIs
        const utilization = await sendDataRequest_U(startDate, endDate, true);
        const forecast = await sendDataRequest_F(startDate, endDate, metricsConfig, prCalcMethod, balanceData, linkedBookings, true);

        return { forecast, utilization };
    } catch (error) {
        console.error("Error generating data:", error);
        return { forecast: null, utilization: null };
    }
};

/**
 * Sends an email with the provided subject and CSV data.
 * @param {Object} params - The email parameters.
 * @param {string} params.subject - The email subject.
 * @param {Object} params.csvData - The CSV data to be sent.
 * @param {string} params.csvFileName - The filename for the attached CSV.
 */
const sendEmail = ({ subject, csvData, csvFileName }) => {
    fetch("/sendemail", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            subject,
            csvData,
            csvFileName
        })
    }).catch(err => {
        console.error("Error sending email:", err);
    });
};

/**
 * Main function to generate data and send forecast & utilization reports via email.
 */
const main = async () => {
    const { forecast, utilization } = await generateData();

    if (forecast && utilization) {
        sendEmail({
            subject: "Eresourcescheduler Data for Capacity Forecast",
            csvData: forecast,
            csvFileName: `Capacity Forecast Report ${getReadableTimestamp()}.csv`
        });

        sendEmail({
            subject: "Eresourcescheduler Data for Utilization",
            csvData: utilization,
            csvFileName: `Utilization Report ${getReadableTimestamp()}.csv`
        });
    } else {
        console.error("Failed to generate forecast or utilization data.");
    }
};