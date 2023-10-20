const rateLimit = require('express-rate-limit');

const rateLimiter = (limit, timeFrameInMinutes) => {
    return rateLimit({
        max: limit,
        window: timeFrameInMinutes * 60 * 1000, //Convert Minutes to milliseconds
        message: {
            error: {
                status: 429,
                message: "CHILL_DAWG",
                expiry: timeFrameInMinutes * 2.5
            }
        }
    })
}

module.exports = rateLimiter;