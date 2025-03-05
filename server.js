const express = require("express");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();
const domain = process.env.ERS_API_DOMAIN;
const token = process.env.ERS_TOKEN;

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/forecast", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "forecast.html"));
});
app.get("/utilization", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "utilization.html"));
});

app.get("/env_config", (req, res) => {
    res.json({
        DATE_RANGE: process.env.DATE_RANGE,
        BALANCE_DATA: process.env.BALANCE_DATA,
        PR_CALC_METHOD: process.env.PR_CALC_METHOD,
        FORECAST_METRICS: process.env.FORECAST_METRICS,
        LINKED_BOOKINGS_ONLY: process.env.LINKED_BOOKINGS_ONLY,
    });
});
app.get("/udf_data_env", (req, res) => {
    res.json({
        PLATFORM_UDF: process.env.PLATFORM_UDF,
        CASE_NUM_UDF: process.env.CASE_NUM_UDF,
        CASE_ID_UDF: process.env.CASE_ID_UDF,
        RELEASE_NUM_UDF: process.env.RELEASE_NUM_UDF,
        PROJ_CODE_UDF: process.env.PROJ_CODE_UDF
    });
});

app.get("/getForecast", async (req, res) => {
    const { start, end, linkedBookingsOnly = false } = req.query; // Use req.query for query parameters

    try {
        const roles = await axios.get(`${domain}/rest/roles`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        const forecast = await axios.get(`${domain}/rest/forecast?start=${start}&end=${end}&calculateGapUsingLinkedBookings=${linkedBookingsOnly}`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        res.send({ msg: "Data fetched", forecast: forecast.data, roles: roles.data });
    } catch (error) {
        console.error("Error fetching data:", error.message);
        res.status(500).send({ msg: "An error occurred", error: error.message });
    }
});

app.get("/getUtilization", async (req, res) => {
    const { start, end } = req.query; // Use req.query for query parameters

    try {
        const roles = await axios.get(`${domain}/rest/roles`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        const utilisation = await axios.get(`${domain}/rest/utilization?start=${start}&end=${end}`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        const projects = await axios.get(`${domain}/rest/utilization/projects-data`, {
            "headers": {
                Authorization: `Bearer ${token}`
            },
            "method": "GET"
        })
        const resourceTypes = await axios.get(`${domain}/rest/resourcetype`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        res.send({ msg: "Data fetched", utilisation: utilisation.data, projects: projects.data.data, roles: roles.data, resourceTypes: resourceTypes.data.data });
    } catch (error) {
        console.error("Error fetching data:", error.message);
        res.status(500).send({ msg: "An error occurred", error: error.message });
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

// API Endpoint to Send Email
app.post("/sendemail", async (req, res) => {
    const { subject, csvData, csvFileName } = req.body;

    if (!subject || !csvData || !csvFileName) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const response = await sendEmail({ subject, csvData, csvFileName });
    console.log(response);
    return res.json(response);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});