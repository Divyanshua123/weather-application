const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    if (
        !authHeader ||
        !authHeader.startsWith("Bearer ")
    ) {

        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const token =
        authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message:
                "Server configuration error: JWT secret is missing"
        });
    }

    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(403).json({
            message: "Invalid or expired token"
        });
    }
}

module.exports = authenticateToken;