const Application = require('../models/application');
const Project = require('../models/project');
const User = require('../models/user');
const JWT = require('jsonwebtoken');
const generateRes = require('../helpers/generateJSON');

/*  TODO ADD REQUEST VERIFICATION!!!! + No multiple Applications?!?!?
    This function handles the application creation for the student accounts. This function should be used with POST requests and 
    requires an access token. This function should create a new applicaiton object in the user's application record as well as create
    an object that has the application object ID and record ID in the project that the student applied too.

    This request takes four fields : 
    projectID (String, the object id of the project that the student is applying to) - professorEmail (String, the email of the professor
    that created the project) - questions (Array, the questions of the application) - answers (Array, the student answers of the questions)
*/
const createApplication = async (req, res) => {
    try {
        //ensure that the number of questions equals number of answers
        if(req.body.answers.length != req.body.questions.length) {generateRes(false, 400, "INPUT_ERROR", { "details": "Numbers of questions and answers do not match" }); return;}

        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);
        //student and faculty record
        let student;
        let faculty;
        //promise to make both user requests at the same time
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
            
            const activeProjectID = faculty.userType.FacultyProjects.Active; //activeProjectID is the id of the activeProjects record for the faculty accounts
            const activeProjects = await Project.findOne(_id = activeProjectID); //grabs the array of active projects from the project record
            if (!activeProjects) { res.status(404).json(generateRes(false, 404, "PROJECT_LIST_NOT_FOUND", {})); return; }

            const existingProject = activeProjects._doc.projects.find(x => x.id === req.body.projectID); //Grabs the specified project from the array by the projectID in the request

            if (!existingProject) { //checks if the project specified by the ID exists
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", { "details": "Invalid projectID" }));
                return;
            }
            //gets the ID of the record that holds the student applications 
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
                //these promises save the application list for the new record
                const savePromises = [
                    applicationList.save(),
                    Project.updateOne({ _id: activeProjectID, "projects": { "$elemMatch": { "_id": existingProject._id } } }, {
                        $push: {
                            'projects.$.applications': {
                                'applicationRecordID': applicationList._id,
                                'application': applicationList.applications[0]._id,
                                'status': "Pending"
                            }
                        }
                    }),
                    User.updateOne({ email: student.email }, {
                        $set: {
                            'userType.studentApplications': applicationList._id
                        }
                    })
                ];
                //save all
                await Promise.all(savePromises);
            } else { //otherwise there exists a faculty record for active projects so add a new element to the record's array
                let newApplication = {
                    questions: req.body.questions,
                    answers: req.body.answers,
                    opportunityRecordId: activeProjectID,
                    opportunityId: existingProject._id,
                    status: "Pending"
                };
                //these await statements cannot be used with a promise because they require the newApplication ID which needs to be 
                //pushed and then fetched from the database
                await Application.updateOne({ _id: applicationRecord }, {
                    $push: { //push new application to the array 
                        applications: newApplication,
                    }
                });
                //Retrieve the updated document and then get the newApplication object into newApp
                const doc = await Application.findOne({ _id: applicationRecord });
                const newApp = doc._doc.applications.find(y => y.opportunityId.toString() == existingProject.id);
                //update the project with a new application
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

/*  This function handles the application deletion for the student accounts. This function should be used with DELETE request and 
    requires an access token. This function should remove the specified application from the student's application record as well as 
    from the array of applications in the faculty's project record.

    This request takes one fields : 
    applicationID (String, the object id of the application to be deleted) 
*/
const deleteApplication = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //get the student and store applicationID in local variable
        const student = await User.findOne({ email: decodeAccessToken.email });
        const applicationID = req.body.applicationID;
        //check if user type is student
        if (student.userType.Type === parseInt(process.env.STUDENT)) {

            if (!applicationID) { //if there isn't an applicationID throw an error
                res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                    errors: error.details,
                    original: error._original
                }));
                return;
            }

            //recordID is the student's application record ID and will be used to get the application list 
            const recordID = student.userType.studentApplications; 

            //gets the application record, otherwise sends error response 
            let applications = await Application.findById(recordID);
            if (!applications) { res.status(404).json(generateRes(false, 404, "APPLICATION_LIST_NOT_FOUND", {})); return; }
            else {
                //get the specific application object to get the project object id and then fetch that project
                const selectedApp = applications._doc.applications.find(y => y.id === applicationID);
                const project = await Project.findOne({ _id: selectedApp.opportunityRecordId });
                //get the specific project index that application is for and then get the index of the respective application object in that project's application array
                const projectIndex = project._doc.projects.findIndex(y => y.id === selectedApp.opportunityId.toString());
                const selectedProjectAppID = project._doc.projects[projectIndex].applications.find(y => y.application.toString() === applicationID);

                /*  these variables are to ensure that an element is removed from the respective arrays
                    projectNumApplicaitons - the number of applications for the specific project | projectSelectedApplication the applicaitons array without the application specified in the request body
                    numApplicaitons - the number of applications in the application record | selectedApplication the applicaitons array without the application specified in the request body
                */
                const projectNumApplications = project._doc.projects[projectIndex].applications.length;
                const projectSelectedApplication = project._doc.projects[projectIndex].applications.pull(selectedProjectAppID._id);
                const numApplications = applications._doc.applications.length;
                const selectedApplication = applications.applications.pull(applicationID);
                //if the length of the new arrays + 1 is not equal to the length of the old arrays, then the application was not removed therefore an error occurred
                if (selectedApplication.length + 1 != numApplications || projectSelectedApplication.length + 1 != projectNumApplications) { //Check that an element was removed, if not send error response
                    res.status(404).json(generateRes(false, 404, "APPLICATION_NOT_FOUND", {}));
                    return;
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

/*  This function handles the application applicaiton retrieval for student applications. It should be used with GET request and requires an
    access token. The request takes no fields in the request body.
*/
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
            let opportunityIDs = {}; //dictionary where each key is a projectRecordID and its value is an array with each element being an array of size 2, with the opporutnityID and the index of that application


            applications.applications.forEach((item, index) => { 
                /*  it was difficult to compare the IDs of the objects in the application as they are not stored as strings but rather objects.
                    So what I did was I added both the ID object and the same ID but with .toString() to make it a string, I then checked if the 
                    ID.toString() was in the array of records and if so I didn't add the duplicated project record id. Below I only grabbed the 
                    even elements to avoid duplication
                */
                if (!recordIDs.includes(item.opportunityRecordId.toString())) {
                    recordIDs.push(item.opportunityRecordId);
                    recordIDs.push(item.opportunityRecordId.toString());
                }

                //This checks if the opporunityIDs object has the opportunityRecord as a field and if not creates an array, otherwise pushes to the array
                if (!opportunityIDs[item.opportunityRecordId.toString()]) {
                    opportunityIDs[item.opportunityRecordId.toString()] = [[item.opportunityId, index]];
                } else {
                    opportunityIDs[item.opportunityRecordId.toString()].push([item.opportunityId, index]);
                }
            });
            //Get the even elements and intialize a return array
            const evenElements = [...recordIDs].filter((element, index) => index % 2 === 0);
            let returnArray = [];
            //get the project records that are in the array of record ids
            const posts = await Project.find({ _id: { $in: evenElements } });
            /*  For each projectrecord in the posts array, check if the opporunityIDs object has a field for that specified projectRecord 
                Then for each of the array elements in the corresponding value, get the application from the index in the value array and the projectIndex from the 
                opporunity id in the value array
            */
            posts.forEach((postItem) => {
                if (opportunityIDs[postItem.id]) {
                    opportunityIDs[postItem.id].forEach((item) => {
                        const appIndex = item[1];
                        const projIndex = postItem._doc.projects.findIndex(y => y.id === item[0].toString());
                        //create a new index for the return array from the values of the project records and application records
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