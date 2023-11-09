const Project = require('../models/project');
const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { projectSchema, deleteProjectSchema } = require('../helpers/inputValidation/validation');
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
                newProject = new Project({
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
                await Project.updateOne({ _id: existingProject }, {
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
        if (user.userType.Type === parseInt(process.env.FACULTY)) {
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

            let recordID;
            switch(req.body.projectType){
                case "active":
                    recordID = user.userType.FacultyProjects.Active;
                    break;
                case "archived":
                    recordID = user.userType.FacultyProjects.Archived;
                    break;
                case "draft":
                    recordID = user.userType.FacultyProjects.Draft;
                    break;
                default:
                    throw error;
            }

            let project = await Project.findById(recordID);
            project.projects.pull(req.body.projectID);
            await project.save();

            res.status(200).json({ success: { status: 200, message: "PROJECT_DELETED" } });

        } else {
            res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
    }
}

const getProjects = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type === parseInt(process.env.FACULTY)) {
            const projectsList = user.userType.FacultyProjects;

            let archivedProjects = await Project.findById(projectsList.Archived);
            let activeProjects = await Project.findById(projectsList.Active);
            let draftProjects = await Project.findById(projectsList.Draft);

            let data = { "archivedProjects": archivedProjects, "activeProjects": activeProjects, "draftProjects": draftProjects };

            res.status(200).json({ success: { status: 200, message: "PROJECTS_FOUND", projects : data } });

        } else {
            res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "BAD_REQUEST" } });
    }
}


module.exports = {
    createProject,
    deleteProject,
    getProjects,
    
};