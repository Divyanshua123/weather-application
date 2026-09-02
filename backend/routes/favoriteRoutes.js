const express = require("express");

const authenticateToken = require("../middleware/auth");

const {
    addFavorite,
    getFavorites,
    deleteFavorite
} = require("../controllers/favoriteController");

const router = express.Router();

// JWT authentication for all favorite routes
router.use(authenticateToken);

// POST /api/favorites
router.post("/", addFavorite);

// GET /api/favorites
router.get("/", getFavorites);

// DELETE /api/favorites/:id
router.delete("/:id", deleteFavorite);

module.exports = router;