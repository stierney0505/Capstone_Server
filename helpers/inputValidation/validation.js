const Joi = require('joi');

const registerSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
    "name": Joi.string().min(2).max(25).required(),
    "password": Joi.string().min(10).max(255).required(),
});

const loginSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
    "password": Joi.string().min(10).max(255).required(),
});

const emailSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
})

const projectSchema = Joi.object({
    "projectName": Joi.string().required(),
    "posted": Joi.date(),
    "description": Joi.string().required(), 
    "questions": Joi.array().items(Joi.string()),
    "requirements": Joi.array().items(
        Joi.object({
            requirementType: Joi.number(),
            requirementValue: Joi.string(),
            required : Joi.boolean().required(),
        })
    ),
})

const deleteProjectSchema = Joi.object({
    "id": Joi.string()
})

module.exports = {
    registerSchema,
    loginSchema,
    emailSchema,
    projectSchema,
    deleteProjectSchema
}