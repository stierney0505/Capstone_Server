const Project = require('../models/project');
const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { projectSchema, deleteProjectSchema } = require('../helpers/inputValidation/validation');
const generateRes = require('../helpers/generateJSON');

/*  This function handles the faculty project creation, should only be used as a POST request, and requires and access token
    This funciton takes information required for creating a faculty project, creates an active project in the DB, and updates the 
    faculty account with the projectID

    The request body requires the following fields : 
    projectType (String, the type of project being created (Draft or Active)) professor (String, name of professor) - 
    projectDetails (Object, contain all the project details) projectDetails fields : 
    posted (Date, date project was created) - description (String, description of the project) - projectName (String, name of the project)
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
            const { error } = projectSchema.validate(req.body.projectDetails);
            if (error || req.body.projectDetails.project.questions.length !== req.body.projectDetails.project.requirements.length) {
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                    errors: error.details,
                    original: error._original
                }));
            }

            let projectType = req.body.projectType; //Stores the projectType and then checks to ensure it is valid
            if (projectType !== "Active" && projectType !== "Draft") { throw error; }
            let existingProject = user.userType.FacultyProjects[projectType]; //Grabs existing project list

            //if there is no active mongodb record for this professor's active projects then create a new record
            if (!existingProject) {
                let newProjectList = new Project({
                    type: req.body.projectType,
                    professor: req.body.professor,
                    projects: [{
                        projectName: req.body.projectDetails.project.projectName,
                        professorId: userId,
                        posted: req.body.projectDetails.project.posted,
                        description: req.body.projectDetails.project.description,
                        questions: req.body.projectDetails.project.questions,
                        requirements: req.body.projectDetails.project.requirements,
                    }]
                });
                await newProjectList.save();
                var $set = { $set: {} }; //This sets up the $set dynamically so that it can either save to DraftProjects or ActiveProjects
                $set.$set['userType.FacultyProjects.' + projectType] = newProjectList._id;

                await User.findOneAndUpdate({ _id: userId }, $set);
            } else { //otherwise there exists a faculty record for active projects so add a new element to the record's array
                let newProject = {
                    projectName: req.body.projectDetails.project.projectName,
                    professorId: userId,
                    posted: req.body.projectDetails.project.posted,
                    description: req.body.projectDetails.project.description,
                    questions: req.body.projectDetails.project.questions,
                    requirements: req.body.projectDetails.project.requirements,
                };
                await Project.updateOne({ _id: existingProject }, {
                    $push: { //push new project to the array 
                        projects: newProject,
                    }
                })
            }
            res.status(200).json(generateRes(true, 200, "PROJECT_CREATED", {}));
        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
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
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                    errors: error.details,
                    original: error._original
                }));
            }

            let recordID; //recordID will be taken from the user's record depending on the projectType field in the request
            switch (req.body.projectType) {
                case "Active":
                    recordID = user.userType.FacultyProjects.Active;
                    break;
                case "Archived":
                    recordID = user.userType.FacultyProjects.Archived;
                    break;
                case "Draft":
                    recordID = user.userType.FacultyProjects.Draft;
                    break;
                default:
                    throw error; //if the projectType is not draft, archived, or active then there is an error
            }

            //gets the project record, otherwise sends error response 
            let project = await Project.findById(recordID);
            if (!project) { res.status(410).json(generateRes(false, 410, "PROJECT_LIST_NOT_FOUND", {})); return; }
            else {
                //If there is no error, get the number of projects from the projects array and then remove an the selected project from the array
                let numProjects = project._doc.projects.length;
                selectedProject = project.projects.pull(req.body.projectID);

                if (selectedProject.length == numProjects) { //Check that an element was removed, if not send error response
                    res.status(410).json(generateRes(false, 410, "PROJECT_NOT_FOUND", {}));
                }
                else {
                    await project.save();
                    res.status(200).json(generateRes(true, 200, "PROJECT_DELETED", {}));
                }
            }

        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
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
            //This specific response doesn't work with the generateRes method, will look into solutions
            res.status(200).json({ success : { status : 200, message : "PROJECTS_FOUND", projects : data}});

        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This function handles the faculty project update requests, should only be used as a PUT request, and requires an access token
    This funciton takes a project ID, project type (Draft, Active, Archived), and all of the project information (changed and unchanged)

    The request body requires the following fields : 
    projectID (String, the id of the project in the DB) - projectType (String, the type of project i.e. Active, Draft, or Archived) - 
    projectDetails (Object, contains all the information for the project, both changed and unchanged fields)
*/
const updateProject = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type == process.env.FACULTY) {
            const userId = user._id;

            //validate schema and ensure that the questions array has as many elements as the requirements array
            const { error } = projectSchema.validate(req.body.projectDetails);
            if (error || req.body.projectDetails.project.questions.length !== req.body.projectDetails.project.requirements.length) {
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                    errors: error.details,
                    original: error._original
                }));
            }

            let recordID; //recordID will be taken from the user's record depending on the projectType field in the request
            switch (req.body.projectType) {
                case "Active":
                    recordID = user.userType.FacultyProjects.Active;
                    break;
                case "Archived":
                    recordID = user.userType.FacultyProjects.Archived;
                    break;
                case "Draft":
                    recordID = user.userType.FacultyProjects.Draft;
                    break;
                default:
                    throw error; //if the projectType is not draft, archived, or active then there is an error
            }

            let project = await Project.findById(recordID);
            if (!project) { res.status(410).json(generateRes(false, 410, "PROJECT_LIST_NOT_FOUND", {})); return; }
            else { //If the project list was found, then continue
                //get and update the project from the project array that has the matching information 
                project = await Project.updateOne({ _id: recordID, "projects": { "$elemMatch": { "_id": req.body.projectID } } }, {
                    $set: {
                        "projects.$.projectName": req.body.projectDetails.project.projectName,
                        "projects.$.professorId": userId,
                        "projects.$.posted": req.body.projectDetails.project.posted,
                        "projects.$.description": req.body.projectDetails.project.description,
                        "projects.$.questions": req.body.projectDetails.project.questions,
                        "projects.$.requirements": req.body.projectDetails.project.requirements,
                    }
                })
                //check that the project was actually updated, if not send error response
                if (project.matchedCount === 0)
                    res.status(410).json(generateRes(false, 410, "PROJECT_NOT_FOUND", {}));
                else
                    res.status(200).json(generateRes(true, 200, "PROJECT_UPDATED", {}));
            }
        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This function handles the archiving of active requests, should only be used as a PUT request, and requires an access token
    This funciton removes the active project from the active project list, and puts that information into a new archived project

    The request body requires the following fields : 
    projectID (String, the objectID of the active project that will be archived)
*/
const archiveProject = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if user type is faculty
        if (user.userType.Type == process.env.FACULTY) {
            if (!req.body.projectID) {
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                    errors: error.details,
                    original: error._original
                }));
            }

            const userId = user._id; //Grabs the active projects from the user specified by the access token and then checks to see if the list exists
            let project = await Project.findById(user.userType.FacultyProjects.Active);
            if (!project) { res.status(410).json(generateRes(false, 410, "PROJECT_LIST_NOT_FOUND", {})); return; }

            const archProject = project._doc.projects.find(x => x.id === req.body.projectID); //Grabs the specified project from the array from the Record
            if (!archProject) {
                res.status(410).json(generateRes(false, 410, "PROJECT_NOT_FOUND", {}));
                return;
            }
            //If there is not an archived project list, create an archived project list
            if (!user.userType.FacultyProjects.Archived) {
                let newArchiveList = new Project({
                    type: "Archived",
                    professor: user.name,
                    projects: [{
                        projectName: archProject.projectName,
                        professorId: archProject.professorId,
                        archived: new Date(),
                        posted: archProject.posted,
                        description: archProject.description,
                        questions: archProject.questions,
                        requirements: archProject.requirements,
                    }]
                });
                await newArchiveList.save(); //Save the archlive list
                var $set = { $set: {} };
                $set.$set['userType.FacultyProjects.' + "Archived"] = newArchiveList._id;
                await User.findOneAndUpdate({ _id: userId }, $set); //Set the archive id in the user facultyProjects
            } else { //otherwise there exists a faculty record for archived projects so add a new element to the record's array
                let newProject = {
                    projectName: archProject.projectName,
                    professorId: archProject.professorId,
                    archived: new Date(),
                    posted: archProject.posted,
                    description: archProject.description,
                    questions: archProject.questions,
                    requirements: archProject.requirements,
                };
                await Project.updateOne({ _id: existingProject }, {
                    $push: { //push new project to the array 
                        projects: newProject,
                    }
                })
            }
            //Grab the length from the array and new length from the active array 
            let numProjects = project._doc.projects.length;
            let selectedProject = project.projects.pull(req.body.projectID);

            if (selectedProject.length == numProjects) { //Check that an element was removed, if not send error response
                res.status(410).json(generateRes(false, 410, "PROJECT_NOT_FOUND", {}));
            }
            else {
                await project.save();
                res.status(200).json(generateRes(true, 200, "PROJECT_ARCHIVED", {}));
            }
        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}



module.exports = {
    createProject, deleteProject,
    getProjects, updateProject,
    archiveProject
};