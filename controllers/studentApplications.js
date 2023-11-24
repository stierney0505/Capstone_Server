const Application = require('../models/application');
const Project = require('../models/project');
const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { projectSchema, deleteProjectSchema } = require('../helpers/inputValidation/validation');
const generateRes = require('../helpers/generateJSON');
const { array } = require('joi');

/*  TODO ADD REQUEST VERIFICATION!!!! + No multiple Applications?!?!?
*/
const createApplication = async (req, res) => {
    try {

        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        let student;
        let faculty;

        const promises = [
            User.findOne({ email: decodeAccessToken.email }),
            User.findOne({ email: req.body.professorEmail })
        ];

        await Promise.all(promises).then(results => {
            student = results[0];
            faculty = results[1];
        });

        //check if user type is student
        if (student && student.userType.Type == process.env.STUDENT) {

            const activeProjectID = faculty.userType.FacultyProjects.Active;
            const activeProjects = await Project.findOne(_id = activeProjectID);
            if (!activeProjects) { res.status(410).json(generateRes(false, 410, "PROJECT_LIST_NOT_FOUND", {})); return; }

            const existingProject = activeProjects._doc.projects.find(x => x.id === req.body.projectID); //Grabs the specified project from the array from the Record

            if (!existingProject) {
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", { "details": "Invalid projectID" }));
                return;
            }

            const applicationRecord = student.userType.studentApplications;

            //if there is no active mongodb record for student's applications then create a new record
            if (!applicationRecord) {
                let applicationList = new Application({
                    user: student.name,
                    applications: [
                        {
                            questions: req.body.questions,
                            answers: req.body.answers,
                            opportunityRecordId: activeProjectID,
                            opportunityId: existingProject._id,
                            status: "Pending"
                        }
                    ]
                });

                const savePromises = [
                    await applicationList.save(),
                    await Project.updateOne({ _id: activeProjectID, "projects": { "$elemMatch": { "_id": existingProject._id } } }, {
                        $push: {
                            'projects.$.applications': {
                                'applicationRecordID': applicationList._id,
                                'application': applicationList.applications[0]._id,
                                'status': "Pending"
                            }
                        }
                    }),
                    await User.updateOne({ email: student.email }, {
                        $set: {
                            'userType.studentApplications': applicationList._id
                        }
                    })
                ];

                await Promise.all(savePromises);
            } else { //otherwise there exists a faculty record for active projects so add a new element to the record's array
                let newApplication = {
                    questions: req.body.questions,
                    answers: req.body.answers,
                    opportunityRecordId: activeProjectID,
                    opportunityId: existingProject._id,
                    status: "Pending"
                };

                await Application.updateOne({ _id: applicationRecord }, {
                    $push: { //push new application to the array 
                        applications: newApplication,
                    }
                });

                const doc = await Application.findOne({ _id: applicationRecord });
                const newApp = doc._doc.applications.find(y => y.opportunityId.toString() == existingProject.id);

                await Project.updateOne({ _id: activeProjectID, "projects": { "$elemMatch": { "_id": existingProject._id } } }, {
                    $push: {
                        'projects.$.applications': {
                            'applicationRecordID': applicationRecord,
                            'application': newApp._id,
                            'status': "Pending"
                        }
                    }
                });
            }
            res.status(200).json(generateRes(true, 200, "APPLICATION_CREATED", {}));
        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

const deleteApplication = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const student = await User.findOne({ email: decodeAccessToken.email });
        const applicationID = req.body.applicationID;
        //check if user type is student
        if (student.userType.Type === parseInt(process.env.STUDENT)) {

            if (!applicationID) { //validates request body otherwise returns an error
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                    errors: error.details,
                    original: error._original
                }));
                return;
            }

            const recordID = student.userType.studentApplications; //recordID will be taken from the user's record depending on the projectType field in the request


            //gets the project record, otherwise sends error response 
            let applications = await Application.findById(recordID);
            if (!applications) { res.status(410).json(generateRes(false, 410, "APPLICATION_LIST_NOT_FOUND", {})); return; }
            else {
                //get the specific application object to get the project object id
                const selectedApp = applications._doc.applications.find(y => y.id === applicationID);
                const project = await Project.findOne({ _id: selectedApp.opportunityRecordId });
                const projectIndex = project._doc.projects.findIndex(y => y.id === selectedApp.opportunityId.toString());
                const selectedProjectAppID = project._doc.projects[projectIndex].applications.find(y => y.application.toString() === applicationID);

                const projectNumApplications = project._doc.projects[projectIndex].applications.length;
                const projectSelectedApplication = project._doc.projects[projectIndex].applications.pull(selectedProjectAppID._id);
                const numApplications = applications._doc.applications.length;
                const selectedApplication = applications.applications.pull(applicationID);



                if (selectedApplication.length + 1 != numApplications || projectSelectedApplication.length + 1 != projectNumApplications) { //Check that an element was removed, if not send error response
                    res.status(410).json(generateRes(false, 410, "APPLICATION_NOT_FOUND", {}));
                }
                else {
                    const savePromises = [
                        project.save(),
                        applications.save()
                    ];

                    await Promise.all(savePromises);
                    res.status(200).json(generateRes(true, 200, "APPLICATION_DELETED", {}));
                }
            }

        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

const getApplications = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //check if user exists
        const student = await User.findOne({ email: decodeAccessToken.email });

        if (student.userType.Type === parseInt(process.env.STUDENT)) {
            const applicationList = student.userType.studentApplications;
            //get the project lists for active, archived, and draft projects
            const applications = await Application.findById(applicationList);
            let recordIDs = []; //array for each projectRecordID
            let opportunityIDs = {}; //dictionary where each key is a projectRecordID and its value is an array of the applied projects


            applications.applications.forEach((item, index) => {
                // Check if the opportunityRecordId is not already in recordIDs
                if (!recordIDs.includes(item.opportunityRecordId.toString())) {
                    recordIDs.push(item.opportunityRecordId);
                    recordIDs.push(item.opportunityRecordId.toString());
                }

                // Create or update the opportunityIDs object
                if (!opportunityIDs[item.opportunityRecordId.toString()]) {
                    opportunityIDs[item.opportunityRecordId.toString()] = [[item.opportunityId, index]];
                } else {
                    opportunityIDs[item.opportunityRecordId.toString()].push([item.opportunityId, index]);
                }
            });

            const evenElements = [...recordIDs].filter((element, index) => index % 2 === 0);
            let returnArray = [];

            const posts = await Project.find({ _id: { $in: evenElements } });

            posts.forEach((postItem) => {
                if (opportunityIDs[postItem.id]) {
                    opportunityIDs[postItem.id].forEach((item) => {
                        const appIndex = item[1];
                        const projIndex = postItem._doc.projects.findIndex(y => y.id === item[0].toString());

                        let newObj = {
                            questions: applications.applications[appIndex].questions,
                            answers: applications.applications[appIndex].answers,
                            status: applications.applications[appIndex].status,
                            opportunityRecordId: applications.applications[appIndex].opportunityRecordId,
                            opportunityId: applications.applications[appIndex].opportunityId,
                            projectName: postItem.projects[projIndex].projectName,
                            prosted: postItem.projects[projIndex].posted,
                            description: postItem.projects[projIndex].description,
                            professorEmail: postItem.professorEmail
                        }
                        returnArray.push(newObj);
                    })
                }
            });

            //This specific response doesn't work with the generateRes method, will look into solutions
            res.status(200).json({ success: { status: 200, message: "APPLICATIONS_FOUND", applications: returnArray } });

        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}



module.exports = {
    createApplication, deleteApplication, getApplications
};