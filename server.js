const express = require("express");
const path = require("path");
const cors = require("cors");
const cron = require("node-cron");
const nodemailer = require("nodemailer");

const forecastJS = require("./forecast_back.js");
const utilizationJS = require("./utilization_back.js");
const mailerJS = require("./mailer.js");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Static page loader
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "forecast.html"));
});
app.get("/utilization", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "utilization.html"));
});

// APIs
app.get("/env_config", (req, res) => {
    res.json({
        DATE_RANGE: process.env.DATE_RANGE,
        BALANCE_DATA: process.env.BALANCE_DATA,
        PR_CALC_METHOD: process.env.PR_CALC_METHOD,
        FORECAST_METRICS: process.env.FORECAST_METRICS,
        LINKED_BOOKINGS_ONLY: process.env.LINKED_BOOKINGS_ONLY,
    });
});

app.post("/getForecastCSV", async (req, res) => {
    try {
        const { startDate, endDate, checkboxes, PRData, BalData, LinkedBookingsOnly } = req.body;
        if (!startDate || !endDate || !checkboxes || !PRData || !BalData || !LinkedBookingsOnly) {
            return res.status(400).json({ error: "Start Date, End Date, PR Data, Bal Data, Linked Bookings Only and Units are required" });
        }
        const response = await forecastJS.sendDataRequest({ startDate, endDate, checkboxes, PRData, BalData, LinkedBookingsOnly, env: process.env });
        return res.json(response);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
})

app.post("/getUtilizationCSV", async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "Start Date and End Date are required" });
        }
        const response = await utilizationJS.sendDataRequest(startDate, endDate, process.env);
        return res.json(response);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

const sendEmail = async ({ subject, csvData, csvFileName }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true, // Use SSL
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        const csvAttachment = {
            filename: csvFileName,
            content: csvData
        };

        const mailOptions = {
            from: `eResource Scheduler ${process.env.SENDER_EMAIL}`,
            to: process.env.RECEIVER_EMAIL,
            subject: subject,
            bcc: process.env.BCC ? process.env.BCC.split(",") : [],
            html: `<p>Kindly find attached custom report from eResource Scheduler.</p>
                    <p>Thank You,<br>eResource Scheduler</p>`,
            attachments: [csvAttachment]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response, new Date());
    } catch (error) {
        console.error('Error sending email:', error);
    }
    return;
};

(JSON.parse(process.env.MAILER) || true) && cron.schedule(process.env.RUN_TIME, async () => {
    try {
        const { forecastEmail, utilizationEmail } = await mailerJS.main(process.env);
        console.log("Running mailer job...");
        await sendEmail(forecastEmail);
        await sendEmail(utilizationEmail);
        console.log("Mailer job completed successfully.");
    } catch (error) {
        console.error("Error running mailer job:", error.message);
    }
});

// Start the server
app.listen(process.env.PORT, async () => {
    console.log(`Server is running at http://localhost:${process.env.PORT}`);
});