require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: [
      "http://127.0.0.1:8000",
      "http://localhost:8000"
    ]
  })
);

app.use(express.json());

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = Number(process.env.PORT) || 5000;

const API_KEY = process.env.API_KEY;

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "weather_app";

/* =========================================================
   FETCH
========================================================= */

const fetch =
  global.fetch ||
  ((...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args)));

/* =========================================================
   API KEY CHECK
========================================================= */

if (!API_KEY) {
  console.warn(
    "WARNING: API_KEY is missing from .env. Weather API requests will fail."
  );
}

function requireApiKey(res) {
  if (!API_KEY) {
    res.status(500).json({
      message: "Server configuration error: API_KEY is missing"
    });

    return false;
  }

  return true;
}

/* =========================================================
   MYSQL
========================================================= */

let pool;

/*
  This first connection does not select a database.
  It allows the application to create weather_app automatically.
*/

async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });

    console.log("Connected to MySQL server");

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``
    );

    console.log(`Database "${DB_NAME}" is ready`);

    await connection.end();

    /*
      Create the actual connection pool.
    */

    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    /*
      Create search history table.
    */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        city VARCHAR(150) NOT NULL,
        country VARCHAR(20),
        temperature DECIMAL(6,2),
        feels_like DECIMAL(6,2),
        humidity INT,
        weather VARCHAR(100),
        description VARCHAR(255),
        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("search_history table is ready");

    /*
      Test the pool.
    */

    await pool.query("SELECT 1");

    console.log("MySQL database connected successfully");

  } catch (error) {
    console.error("MySQL initialization failed:");
    console.error(error.message);

    /*
      We don't terminate the server here.
      This lets /health report the database error.
    */
  }
}

/* =========================================================
   HOME ROUTE
========================================================= */

app.get("/", (req, res) => {
  res.json({
    message: "Weather Application Backend API",
    status: "running"
  });
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({
        status: "error",
        backend: "running",
        database: "disconnected"
      });
    }

    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      backend: "running",
      database: "connected"
    });

  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(500).json({
      status: "error",
      backend: "running",
      database: "disconnected",
      error: error.message
    });
  }
});

/* =========================================================
   WEATHER ROUTE

   Example:
   http://127.0.0.1:5000/weather/Delhi
========================================================= */

app.get("/weather/:city", async (req, res) => {
  if (!requireApiKey(res)) {
    return;
  }

  const city = req.params.city.trim();

  console.log("City requested:", city);

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(city)}` +
      `&appid=${API_KEY}` +
      `&units=metric`;

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.message || "Unable to retrieve weather"
      });
    }

    /*
      Save successful search in MySQL.
    */

    if (pool) {
      try {
        await pool.execute(
          `
          INSERT INTO search_history
          (
            city,
            country,
            temperature,
            feels_like,
            humidity,
            weather,
            description
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            data.name || city,

            data.sys?.country || null,

            data.main?.temp ?? null,

            data.main?.feels_like ?? null,

            data.main?.humidity ?? null,

            data.weather?.[0]?.main || null,

            data.weather?.[0]?.description || null
          ]
        );

        console.log(`Search saved to MySQL: ${data.name || city}`);

      } catch (databaseError) {
        /*
          Weather should still work even if history cannot
          be stored.
        */

        console.error(
          "Unable to save weather search:",
          databaseError.message
        );
      }
    }

    res.json(data);

  } catch (error) {
    console.error("Weather error:", error);

    res.status(500).json({
      message: "Unable to retrieve weather information"
    });
  }
});

/* =========================================================
   FORECAST ROUTE

   Example:
   http://127.0.0.1:5000/forecast/Delhi
========================================================= */

app.get("/forecast/:city", async (req, res) => {
  if (!requireApiKey(res)) {
    return;
  }

  const city = req.params.city.trim();

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/forecast` +
      `?q=${encodeURIComponent(city)}` +
      `&appid=${API_KEY}` +
      `&units=metric`;

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.message || "Unable to retrieve forecast"
      });
    }

    res.json(data);

  } catch (error) {
    console.error("Forecast error:", error);

    res.status(500).json({
      message: "Forecast error"
    });
  }
});

/* =========================================================
   AIR QUALITY ROUTE

   Example:
   /air-quality/28.6139/77.2090
========================================================= */

app.get("/air-quality/:lat/:lon", async (req, res) => {
  if (!requireApiKey(res)) {
    return;
  }

  const { lat, lon } = req.params;

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/air_pollution` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&appid=${API_KEY}`;

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.message || "Unable to retrieve air quality"
      });
    }

    res.json({
      air: data
    });

  } catch (error) {
    console.error("AQI error:", error);

    res.status(500).json({
      message: "AQI error"
    });
  }
});

/* =========================================================
   LOCATION WEATHER

   Example:
   /weather-location/28.6139/77.2090
========================================================= */

app.get("/weather-location/:lat/:lon", async (req, res) => {
  if (!requireApiKey(res)) {
    return;
  }

  const { lat, lon } = req.params;

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&appid=${API_KEY}` +
      `&units=metric`;

    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.message || "Unable to retrieve location weather"
      });
    }

    res.json(data);

  } catch (error) {
    console.error("Location weather error:", error);

    res.status(500).json({
      message: "Location weather error"
    });
  }
});

/* =========================================================
   SEARCH HISTORY

   http://127.0.0.1:5000/history
========================================================= */

app.get("/history", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        message: "Database is not connected"
      });
    }

    const [rows] = await pool.query(`
      SELECT
        id,
        city,
        country,
        temperature,
        feels_like,
        humidity,
        weather,
        description,
        searched_at
      FROM search_history
      ORDER BY searched_at DESC
      LIMIT 20
    `);

    res.json(rows);

  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      message: "Unable to retrieve search history"
    });
  }
});

/* =========================================================
   DELETE SEARCH HISTORY
========================================================= */

app.delete("/history", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        message: "Database is not connected"
      });
    }

    await pool.query("DELETE FROM search_history");

    res.json({
      message: "Search history cleared successfully"
    });

  } catch (error) {
    console.error("Delete history error:", error);

    res.status(500).json({
      message: "Unable to clear search history"
    });
  }
});

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found"
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  /*
    Initialize MySQL first.
  */

  await initializeDatabase();

  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("=========================================");
    console.log(" Weather Application Backend");
    console.log("=========================================");
    console.log(`Server:  http://127.0.0.1:${PORT}`);
    console.log(`Health:  http://127.0.0.1:${PORT}/health`);
    console.log(`History: http://127.0.0.1:${PORT}/history`);
    console.log("=========================================");
  });

  server.on("error", error => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use.`);
      console.error(
        "Stop the previous Node server and run npm start again."
      );
    } else {
      console.error("Server error:", error);
    }

    process.exit(1);
  });
}

startServer();