const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

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

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            message: "Invalid authorization header"
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(403).json({
            message: "Invalid or expired token"
        });
    }
}

// =========================
// POST /api/history
// SAVE SEARCH HISTORY
// =========================

router.post("/", authenticateToken, async (req, res) => {

    try {

        const { city } = req.body;

        if (!city) {
            return res.status(400).json({
                message: "City is required"
            });
        }

        const db = req.app.locals.db;

        if (!db) {
            return res.status(500).json({
                message: "Database connection is not available"
            });
        }

        await db.execute(
            `
            INSERT INTO search_history
            (user_id, city)
            VALUES (?, ?)
            `,
            [req.user.id, city]
        );

        return res.status(201).json({
            message: "Search history saved successfully",
            city: city
        });

    } catch (error) {

        console.error("Save history error:", error);

        return res.status(500).json({
            message: "Unable to save search history"
        });
    }
});

// =========================
// GET /api/history
// GET USER SEARCH HISTORY
// =========================

router.get("/", authenticateToken, async (req, res) => {

    try {

        const db = req.app.locals.db;

        if (!db) {
            return res.status(500).json({
                message: "Database connection is not available"
            });
        }

        const [rows] = await db.execute(
            `
            SELECT
                id,
                city,
                searched_at
            FROM search_history
            WHERE user_id = ?
            ORDER BY searched_at DESC
            `,
            [req.user.id]
        );

        return res.json(rows);

    } catch (error) {

        console.error("Get history error:", error);

        return res.status(500).json({
            message: "Unable to load search history"
        });
    }
});

// =========================
// DELETE /api/history/:id
// DELETE HISTORY ITEM
// =========================

router.delete("/:id", authenticateToken, async (req, res) => {

    try {

        const { id } = req.params;

        const db = req.app.locals.db;

        if (!db) {
            return res.status(500).json({
                message: "Database connection is not available"
            });
        }

        const [result] = await db.execute(
            `
            DELETE FROM search_history
            WHERE id = ? AND user_id = ?
            `,
            [id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "History item not found"
            });
        }

        return res.json({
            message: "History item deleted successfully"
        });

    } catch (error) {

        console.error("Delete history error:", error);

        return res.status(500).json({
            message: "Unable to delete history item"
        });
    }
});

module.exports = router;