const { pool } = require("../config/db");

// ADD SEARCH HISTORY
async function addHistory(req, res) {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const { city } = req.body;

        if (!city) {
            return res.status(400).json({
                message: "City is required"
            });
        }

        const safeCity = city.trim();

        if (!safeCity) {
            return res.status(400).json({
                message: "City is required"
            });
        }

        await pool.execute(
            `INSERT INTO search_history (user_id, city)
             VALUES (?, ?)`,
            [req.user.id, safeCity]
        );

        res.status(201).json({
            message: "Search saved"
        });

    } catch (error) {
        console.error("Add history error:", error);

        res.status(500).json({
            message: "Unable to save search"
        });
    }
}


// GET SEARCH HISTORY
async function getHistory(req, res) {
    try {
        const [rows] = await pool.execute(
            `SELECT id, city, searched_at
             FROM search_history
             WHERE user_id = ?
             ORDER BY searched_at DESC
             LIMIT 20`,
            [req.user.id]
        );

        res.status(200).json(rows);

    } catch (error) {
        console.error("Get history error:", error);

        res.status(500).json({
            message: "Unable to fetch history"
        });
    }
}


// CLEAR SEARCH HISTORY
async function clearHistory(req, res) {
    try {
        await pool.execute(
            `DELETE FROM search_history
             WHERE user_id = ?`,
            [req.user.id]
        );

        res.status(200).json({
            message: "History cleared"
        });

    } catch (error) {
        console.error("Clear history error:", error);

        res.status(500).json({
            message: "Unable to clear history"
        });
    }
}


module.exports = {
    addHistory,
    getHistory,
    clearHistory
};