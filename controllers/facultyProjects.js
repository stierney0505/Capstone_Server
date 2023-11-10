const Project = require('../models/project');
const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { projectSchema, deleteProjectSchema } = require('../helpers/inputValidation/validation');
const mongoose = require('mongoose');

/*  This function handles the faculty project creation, should only be used as a POST request, and requires and access token
    This funciton takes information required for creating a faculty project, creates an active project in the DB, and updates the 
    faculty account with the projectID

    The request body requires the following fields : 
    professor (String, name of professor) - posted (Date, date project was created) - description (String, description of the project)
    questions (Array of Strings, questions for applicants) - requirements (Array of Objects, the objects have the fields requirementType (int), 
    requirement Value (TBD), and required (Boolean))
*/
const createProject = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1]; 
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type == process.env.FACULTY) {
            const userId = user._id;
            
            //validate schema and ensure that the questions array has as many elements as the requirements array
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

            //if there is no active mongodb record for this professor's active projects then create a new record
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
                    $set: { //Update the professor's activeProjects field to point to the newly created record
                        'userType.FacultyProjects.Active': newProject._id,
                    },
                });
            } else { //otherwise there exists a faculty record for active projects so add a new element to the record's array
                newProject = {
                    projectName: req.body.project.projectName,
                    professorId: userId,
                    posted: req.body.project.posted,
                    description: req.body.project.description,
                    questions: req.body.project.description,
                    requirements: req.body.project.requirements,
                };
                await Project.updateOne({ _id: existingProject }, {
                    $push: { //push new project to the array 
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

/*  This function handles the faculty project deletion, should only be used with a DELETE request, and requires an access token
    This funciton takes the projectID and type and deletes the project specified, either active, draft, or archived
    
    The request body requires the following fields : 
    projectID (String, the mongodb __id of the project object to delete from array) - projectType (String, the type of project to delete)
*/
const deleteProject = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type === parseInt(process.env.FACULTY)) {
            const { error } = deleteProjectSchema.validate(req.body);
            if (error) { //validates request body otherwise returns an error
                res.status(400).json({
                    error: {
                        status: 400,
                        message: 'INPUT_ERROR',
                        errors: error.details,
                        original: error._original
                    }
                });
            }

            let recordID; //recordID will be taken from the user's record depending on the projectType field in the request
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
                    throw error; //if the projectType is not draft, archived, or active then there is an error
            }

            //gets the project record, removes the project from the array and then saves
            let project = await Project.findById(recordID);
            if(!project) { res.status(200).json({ error: { status: 410, message: "ITEM_NOT_FOUND"}})}
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

/*  This function handles the requests to get the faculty projects, it should only be used with GET requests, and requires a valid access token

    The request body requires no fields
*/
const getProjects = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type === parseInt(process.env.FACULTY)) {
            const projectsList = user.userType.FacultyProjects;
            //get the project lists for active, archived, and draft projects
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