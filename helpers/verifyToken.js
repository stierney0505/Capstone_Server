const JWT = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        const token = req.header('authorization').split(' ')[1]

        if (token) {
            try {
                req.user = JWT.verify(token, process.env.SECRET_ACCESS_TOKEN);
                next();
            } catch (error) {
                console.log(error0);
                res.status(401).json({ error: { status: 401, message: "BAD_TOKEN" } });
            }

        } else {
            res.status(400).json({ error: { status: 401, message: "Access Denied1" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "Access Denied2" } });
    }
}

module.exports = auth;