const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// =========================
// LOAD ENVIRONMENT VARIABLES
// =========================

dotenv.config();

// =========================
// IMPORT ROUTES
// =========================

const historyRoutes = require("./routes/historyRoutes");

// =========================
// APP INITIALIZATION
// =========================

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;

const WEATHER_API_KEY =
    process.env.WEATHER_API_KEY || process.env.API_KEY;

// =========================
// ENVIRONMENT CHECK
// =========================

if (!JWT_SECRET) {
    console.error("JWT_SECRET is missing in .env");
    process.exit(1);
}

if (!WEATHER_API_KEY) {
    console.error(
        "WEATHER_API_KEY or API_KEY is missing in .env"
    );
    process.exit(1);
}

// =========================
// MIDDLEWARE
// =========================

app.use(cors());

app.use(express.json());

// =========================
// MYSQL CONNECTION
// =========================

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "skycast_db",

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0
});

// Make database available to routes
app.locals.db = pool;

// =========================
// HISTORY ROUTES
// =========================

app.use("/api/history", historyRoutes);

// =========================
// ROOT ROUTE
// =========================

app.get("/", (req, res) => {

    res.json({
        status: "OK",
        message: "SkyCast Pro backend is running"
    });

});

// =========================
// DATABASE INITIALIZATION
// =========================

async function initializeDatabase() {

    try {

        const connection = await pool.getConnection();

        console.log("Connected to MySQL server");

        // =========================
        // USERS TABLE
        // =========================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,

                name VARCHAR(100) NOT NULL,

                email VARCHAR(150) NOT NULL UNIQUE,

                password VARCHAR(255) NOT NULL,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("users table is ready");

        // =========================
        // FAVORITES TABLE
        // =========================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS favorite_cities (
                id INT AUTO_INCREMENT PRIMARY KEY,

                user_id INT NOT NULL,

                city VARCHAR(100) NOT NULL,

                country VARCHAR(100),

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
            )
        `);

        console.log("favorite_cities table is ready");

        // =========================
        // SEARCH HISTORY TABLE
        // =========================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS search_history (
                id INT AUTO_INCREMENT PRIMARY KEY,

                user_id INT NOT NULL,

                city VARCHAR(100) NOT NULL,

                searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
            )
        `);

        console.log("search_history table is ready");

        connection.release();

        console.log("MySQL database connected successfully");

    } catch (error) {

        console.error(
            "Database initialization failed:"
        );

        console.error(error.message);

        process.exit(1);
    }
}

// =========================
// JWT AUTHENTICATION
// =========================

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            message: "Access token required"
        });

    }

    const parts = authHeader.split(" ");

    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {

        return res.status(401).json({
            message: "Invalid authorization header"
        });

    }

    const token = parts[1];

    try {

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(403).json({
            message: "Invalid or expired token"
        });

    }
}

// =========================
// REGISTER
// =========================

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;

            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    message:
                        "Name, email and password are required"
                });

            }

            if (password.length < 6) {

                return res.status(400).json({
                    message:
                        "Password must contain at least 6 characters"
                });

            }

            const [existingUsers] =
                await pool.execute(
                    "SELECT id FROM users WHERE email = ?",
                    [email]
                );

            if (existingUsers.length > 0) {

                return res.status(409).json({
                    message:
                        "Email already registered"
                });

            }

            const hashedPassword =
                await bcrypt.hash(password, 10);

            await pool.execute(
                `
                INSERT INTO users
                (name, email, password)
                VALUES (?, ?, ?)
                `,
                [
                    name,
                    email,
                    hashedPassword
                ]
            );

            return res.status(201).json({
                message:
                    "Registration successful"
            });

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            return res.status(500).json({
                message:
                    "Internal server error"
            });

        }

    }
);

// =========================
// LOGIN
// =========================

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;

            if (!email || !password) {

                return res.status(400).json({
                    message:
                        "Email and password are required"
                });

            }

            const [users] =
                await pool.execute(
                    "SELECT * FROM users WHERE email = ?",
                    [email]
                );

            if (users.length === 0) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }

            const user = users[0];

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }

            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email
                },

                JWT_SECRET,

                {
                    expiresIn: "1h"
                }
            );

            return res.json({

                message:
                    "Login successful",

                token

            });

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            return res.status(500).json({
                message:
                    "Internal server error"
            });

        }

    }
);

// =========================
// WEATHER
// =========================

app.get(
    "/weather/:city",
    async (req, res) => {

        try {

            const city = req.params.city;

            const url =
                `https://api.openweathermap.org/data/2.5/weather` +
                `?q=${encodeURIComponent(city)}` +
                `&appid=${WEATHER_API_KEY}` +
                `&units=metric`;

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    message:
                        data.message ||
                        "Weather data unavailable"

                });

            }

            res.json(data);

        } catch (error) {

            console.error(
                "Weather API error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to fetch weather data"

            });

        }

    }
);

// =========================
// FORECAST
// =========================

app.get(
    "/forecast/:city",
    async (req, res) => {

        try {

            const city = req.params.city;

            const url =
                `https://api.openweathermap.org/data/2.5/forecast` +
                `?q=${encodeURIComponent(city)}` +
                `&appid=${WEATHER_API_KEY}` +
                `&units=metric`;

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    message:
                        data.message ||
                        "Forecast unavailable"

                });

            }

            res.json(data);

        } catch (error) {

            console.error(
                "Forecast API error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to fetch forecast"

            });

        }

    }
);

// =========================
// WEATHER BY LOCATION
// =========================

app.get(
    "/weather-location/:lat/:lon",
    async (req, res) => {

        try {

            const {
                lat,
                lon
            } = req.params;

            const url =
                `https://api.openweathermap.org/data/2.5/weather` +
                `?lat=${encodeURIComponent(lat)}` +
                `&lon=${encodeURIComponent(lon)}` +
                `&appid=${WEATHER_API_KEY}` +
                `&units=metric`;

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    message:
                        data.message ||
                        "Location weather unavailable"

                });

            }

            res.json(data);

        } catch (error) {

            console.error(
                "Location weather error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to fetch location weather"

            });

        }

    }
);

// =========================
// AIR QUALITY
// =========================

app.get(
    "/air-quality/:lat/:lon",
    async (req, res) => {

        try {

            const {
                lat,
                lon
            } = req.params;

            const url =
                `https://api.openweathermap.org/data/2.5/air_pollution` +
                `?lat=${encodeURIComponent(lat)}` +
                `&lon=${encodeURIComponent(lon)}` +
                `&appid=${WEATHER_API_KEY}`;

            const response =
                await fetch(url);

            const data =
                await response.json();

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    message:
                        data.message ||
                        "Air quality unavailable"

                });

            }

            res.json({
                air: data
            });

        } catch (error) {

            console.error(
                "AQI error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to fetch air quality"

            });

        }

    }
);

// =========================
// FAVORITES - GET
// =========================

app.get(
    "/api/favorites",
    authenticateToken,
    async (req, res) => {

        try {

            const [rows] =
                await pool.execute(
                    `
                    SELECT
                        id,
                        city,
                        country,
                        created_at
                    FROM favorite_cities
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    `,
                    [req.user.id]
                );

            res.json(rows);

        } catch (error) {

            console.error(
                "Get favorites error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to load favorites"

            });

        }

    }
);

// =========================
// FAVORITES - ADD
// =========================

app.post(
    "/api/favorites",
    authenticateToken,
    async (req, res) => {

        try {

            const { city } = req.body;

            if (!city) {

                return res.status(400).json({

                    message:
                        "City is required"

                });

            }

            const [existing] =
                await pool.execute(
                    `
                    SELECT id
                    FROM favorite_cities
                    WHERE user_id = ?
                    AND city = ?
                    `,
                    [
                        req.user.id,
                        city
                    ]
                );

            if (existing.length > 0) {

                return res.status(409).json({

                    message:
                        "City already in favorites"

                });

            }

            await pool.execute(
                `
                INSERT INTO favorite_cities
                (user_id, city)
                VALUES (?, ?)
                `,
                [
                    req.user.id,
                    city
                ]
            );

            res.status(201).json({

                message:
                    "City added to favorites"

            });

        } catch (error) {

            console.error(
                "Add favorite error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to save favorite"

            });

        }

    }
);

// =========================
// FAVORITES - DELETE
// =========================

app.delete(
    "/api/favorites/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const { id } = req.params;

            const [result] =
                await pool.execute(
                    `
                    DELETE FROM favorite_cities
                    WHERE id = ?
                    AND user_id = ?
                    `,
                    [
                        id,
                        req.user.id
                    ]
                );

            if (result.affectedRows === 0) {

                return res.status(404).json({

                    message:
                        "Favorite not found"

                });

            }

            res.json({

                message:
                    "Favorite removed"

            });

        } catch (error) {

            console.error(
                "Delete favorite error:",
                error
            );

            res.status(500).json({

                message:
                    "Unable to delete favorite"

            });

        }

    }
);

// =========================
// HEALTH CHECK
// =========================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            status: "OK",

            message:
                "SkyCast Pro backend is running"

        });

    }
);

// =========================
// 404 HANDLER
// =========================

app.use(
    (req, res) => {

        res.status(404).json({

            message:
                "Route not found"

        });

    }
);

// =========================
// START SERVER
// =========================

async function startServer() {

    await initializeDatabase();

    app.listen(
        PORT,
        () => {

            console.log("");
            console.log(
                "================================"
            );

            console.log(
                "SkyCast Pro Backend"
            );

            console.log(
                `Server running on port ${PORT}`
            );

            console.log(
                `http://localhost:${PORT}`
            );

            console.log(
                "================================"
            );

        }
    );
}

startServer();