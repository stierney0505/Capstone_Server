const Joi = require('joi');

const registerSchema = Joi.object({
    "email": Joi.string().min(6).max(30).email().required(),
    "name": Joi.string().min(2).max(25).required(),
    "password": Joi.string().min(10).max(255).required(),
    "accountType": Joi.number().max(2).min(0),
});

const loginSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
    "password": Joi.string().min(10).max(255).required(),
});

const emailSchema = Joi.object({
    "email": Joi.string().min(6).max(25).email().required(),
})

const projectSchema = Joi.object({
    "project": Joi.object({
        "projectName": Joi.string().required(),
        "posted": Joi.date(),
        "description": Joi.string().required(),
        "questions": Joi.array().items(Joi.string()),
        "requirements": Joi.array().items(
            Joi.object({
                requirementType: Joi.number(),
                requirementValue: Joi.string(),
                required: Joi.boolean().required(),
            })
        ),
    }).required(),
})

const deleteProjectSchema = Joi.object({
    "projectID": Joi.string().required(),
    "projectType": Joi.string().required()
})

const createApplicationSchema = Joi.object({
    "projectID": Joi.string().required(),
    "professorEmail": Joi.string().required(),
    "questions": Joi.array().required(),
    "answers": Joi.array().required()
})

const appDecision = Joi.object({
    "projectID": Joi.string().required(),
    "applicationID": Joi.string().required(),
    "decision": Joi.string().required()
})

module.exports = {
    registerSchema,
    loginSchema,
    emailSchema,
    projectSchema,
    deleteProjectSchema,
    appDecision
}