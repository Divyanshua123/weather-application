
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

const DEFAULT_PORT = 5001;
let PORT = parseInt(process.env.PORT, 10) || DEFAULT_PORT;

const API_KEY = process.env.API_KEY;

const fetch =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));

if (!API_KEY) {
  console.warn("Warning: OPENWEATHER_API_KEY is not set. Weather API calls will fail until the key is provided.");
}

const requireApiKey = (res) => {
  if (!API_KEY) {
    res.status(500).json({
      message: "Server misconfiguration: missing OpenWeatherMap API key"
    });
    return false;
  }
  return true;
};

/* =========================
   WEATHER ROUTE
========================= */

app.get("/weather/:city", async (req, res) => {

    const city = req.params.city;

    console.log("City Requested:", city);

    try {

        const url =
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;

        console.log(url);

        const response = await fetch(url);

        const data = await response.json();

        console.log(data);

        if (data.cod !== 200) {

            return res.status(404).json({
                message: data.message || "City not found"
            });
        }

        res.json(data);

    }

    catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

/* =========================
   FORECAST ROUTE
========================= */

app.get("/forecast/:city", async (req, res) => {

    const city = req.params.city;

    try {

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`
        );

        const data = await response.json();

        res.json(data);

    }

    catch (error) {

        res.status(500).json({
            message: "Forecast error"
        });
    }
});

/* =========================
   AIR QUALITY ROUTE
========================= */

app.get("/air-quality/:lat/:lon", async (req, res) => {

    const { lat, lon } = req.params;

    try {

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
        );

        const data = await response.json();

        res.json({
            air: data
        });

    }

    catch (error) {

        res.status(500).json({
            message: "AQI error"
        });
    }
});

/* =========================
   LOCATION WEATHER
========================= */

app.get("/weather-location/:lat/:lon", async (req, res) => {

    const { lat, lon } = req.params;

    try {

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        );

        const data = await response.json();

        res.json(data);

    }

    catch (error) {

        res.status(500).json({
            message: "Location weather error"
        });
    }
});

/* =========================
   START SERVER
========================= */

const startServer = port => {
    const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });

    server.on("error", error => {
        if (error.code === "EADDRINUSE") {
            const fallbackPort = port + 1;
            console.warn(`Port ${port} is in use. Trying port ${fallbackPort}...`);
            PORT = fallbackPort;
            startServer(fallbackPort);
        }
        else {
            console.error(error);
            process.exit(1);
        }
    });
};

startServer(PORT);

