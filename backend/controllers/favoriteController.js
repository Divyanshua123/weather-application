const {
    pool
} = require("../config/db");


async function addFavorite(req, res) {

    try {

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const {
            city,
            country
        } = req.body;

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
            `INSERT INTO favorite_cities
            (user_id, city, country)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
            city = VALUES(city)`,
            [
                req.user.id,
                safeCity,
                country ? country.trim() : null
            ]
        );

        res.status(201).json({
            message:
                "City added to favorites"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message:
                "Unable to save favorite"
        });
    }
}


async function getFavorites(req, res) {

    try {

        const [rows] =
            await pool.execute(
                `SELECT *
                 FROM favorite_cities
                 WHERE user_id = ?
                 ORDER BY created_at DESC`,
                [req.user.id]
            );

        res.json(rows);

    } catch (error) {

        res.status(500).json({
            message:
                "Unable to fetch favorites"
        });
    }
}


async function deleteFavorite(req, res) {

    try {

        const {
            id
        } = req.params;

        await pool.execute(
            `DELETE FROM favorite_cities
             WHERE id = ?
             AND user_id = ?`,
            [
                id,
                req.user.id
            ]
        );

        res.json({
            message:
                "Favorite removed"
        });

    } catch (error) {

        res.status(500).json({
            message:
                "Unable to delete favorite"
        });
    }
}


module.exports = {
    addFavorite,
    getFavorites,
    deleteFavorite
};