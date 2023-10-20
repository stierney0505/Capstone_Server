const Joi = require('joi');

const registerSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
    "password": Joi.string().min(10).max(255).required(),
});

const loginSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
    "password": Joi.string().min(10).max(255).required(),
});

const emailSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
})

module.exports = {
    registerSchema,
    loginSchema,
    emailSchema
}