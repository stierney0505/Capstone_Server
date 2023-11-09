const project = require('../models/project');
const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { projectSchema, deleteProjectSchema } = require('../helpers/inputValidation/validation');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const createProject = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type == process.env.FACULTY) {
            const userId = user._id;

            const { error } = projectSchema.validate(req.body.project);

            if (error || req.body.project.questions.length !== req.body.project.requirements.length) {
                res.status(400).json({
                    error: {
                        status: 400,
                        message: 'INPUT_ERROR',
                        errors: error.details,
                        original: error._original
                    }
                });
            }

            let newProject;
            let existingProject = user.userType.FacultyProjects.Active;

            if (!user.userType.FacultyProjects.Active) {
                newProject = new project({
                    professor: req.body.professor,
                    projects: [{
                        projectName: req.body.project.projectName,
                        professorId: userId,
                        posted: req.body.project.posted,
                        description: req.body.project.description,
                        questions: req.body.project.description,
                        requirements: req.body.project.requirements,
                    }]
                });
                await newProject.save();
                await User.findOneAndUpdate({ _id: userId }, {
                    $set: { //need to fix this with the db
                        'userType.FacultyProjects.Active': newProject._id,
                    },
                });
            } else {
                newProject = {
                    projectName: req.body.project.projectName,
                    professorId: userId,
                    posted: req.body.project.posted,
                    description: req.body.project.description,
                    questions: req.body.project.description,
                    requirements: req.body.project.requirements,
                };
                await project.updateOne({ _id: existingProject }, {
                    $push: {
                        projects: newProject,
                    }
                })
            }

            res.status(200).json({ success: { status: 200, message: "PROJECT_CREATED" } });

        } else {
            res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
    }
}

const deleteProject = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type == process.env.FACULTY) {
            const userId = user._id;

            const { error } = deleteProjectSchema.validate(req.body);

            if (error) {
                res.status(400).json({
                    error: {
                        status: 400,
                        message: 'INPUT_ERROR',
                        errors: error.details,
                        original: error._original
                    }
                });
            }
            const objectId = new mongoose.Types.ObjectId(req.body.id);
            resut = await project.deleteMany({ "professor": "SEAN" });

            res.status(200).json({ success: { status: 200, message: "PROJECT_DELETED" } });

        } else {
            res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
    }
}



module.exports = {
    createProject,
    deleteProject
};