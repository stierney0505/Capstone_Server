const JWT = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        const token = req.header('authorization').split(' ')[1]

        if (token) {
            try {
                req.user = JWT.verify(token, process.env.SECRET_ACCESS_TOKEN);
                next();
            } catch (error) {
                console.log(error);
                res.status(401).json({ error: { status: 401, message: "INVALID_ACCESS_TOKEN" } });
            }

        } else {
            res.status(400).json({ error: { status: 401, message: "NO_TOKEN" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "ACCESS_DENIED" } });
    }
}

module.exports = auth;