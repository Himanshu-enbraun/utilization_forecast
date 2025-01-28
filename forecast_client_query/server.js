const express = require("express");
const path = require("path");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Define a basic route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/getData", async (req, res) => {
    const { start, end } = req.query; // Use req.query for query parameters
    const domain = 'http://localhost:8080';
    const token = 'rz5luh8z5ag2c30ph03tzgqbovyvoq';

    try {
        const forecast = await axios.get(`${domain}/rest/forecast?start=${start}&end=${end}`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        res.send({ msg: "Data fetched", forecast: forecast.data});
    } catch (error) {
        console.error("Error fetching data:", error.message);
        res.status(500).send({ msg: "An error occurred", error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});