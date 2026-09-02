const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
    pool
} = require("../config/db");


async function register(req, res) {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        if (!name || !email || !password) {

            return res.status(400).json({
                message: "All fields are required"
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
                message: "Email already registered"
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const [result] =
            await pool.execute(
                `INSERT INTO users
                (name, email, password)
                VALUES (?, ?, ?)`,
                [
                    name,
                    email,
                    hashedPassword
                ]
            );

        res.status(201).json({
            message: "Registration successful",
            userId: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
}


async function login(req, res) {

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

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message:
                    "Server configuration error: JWT secret is missing"
            });
        }

        const token =
            jwt.sign(
                {
                    id: user.id,
                    email: user.email
                },

                process.env.JWT_SECRET,

                {
                    expiresIn: "2h"
                }
            );

        res.json({
            message: "Login successful",

            token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
}


module.exports = {
    register,
    login
};