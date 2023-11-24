const chai = require('chai');
const chaiHTTP = require('chai-http');
const server = require('../server.js');
const User = require('../models/user');
const Project = require('../models/project.js');

const expect = chai.expect;
chai.use(chaiHTTP);

let projectID, access_token, removeID, projectRecordID, draftID, draftRecordID, archiveRecordID;

const randomPass = Math.random().toString(36).substring(0).repeat(2);
const randomName = Math.random().toString(36).substring(2);
const randomEmail = Math.random().toString(36).substring(8) + "@gmail.com";


//This waits for the connection to the DB to be set up before running the tests
before(function (done) {
    this.timeout(4000);
    setTimeout(done, 3000);
});


describe('POST /api/register', () => {
    it('should return a registeration success response', (done) => {
        chai.request(server)
            .post('/api/register')
            .send({ "email": randomEmail, "name": randomName, "password": randomPass, "accountType": 1 })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal('REGISTER_SUCCESS');

                expect(res.body.success).to.have.property('accessToken');
                expect(res.body.success).to.have.property('refreshToken');
                expect(res.body.success).to.have.property('user');
                expect(res.body.success.user).to.have.property('id');

                access_token = res.body.success.accessToken;
                removeID = res.body.success.user.id;
                done();
            });
    });
});

describe('POST /api/projects/createProject', () => {
    it('should return a successful active project creation response', (done) => {
        chai.request(server)
            .post('/api/projects/createProject')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({
                "professorEmail": randomEmail,
                "projectType": "Active",
                "projectDetails": {
                    "project": {
                        "projectName": "Test 2 PROJECT",
                        "posted": "Wed Nov 01 2023 21:10:11 GMT-0400 (Eastern Daylight Time)",
                        "description": "A pretty cool project!",
                        "questions": [
                            "Do you want to do this project?"
                        ],
                        "requirements": [
                            {
                                "requirementType": 1,
                                "requirementValue": "IDK what this is",
                                "required": true
                            }
                        ]
                    }
                }
            })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal('PROJECT_CREATED');
                done();
            });
    });
});

describe('POST /api/projects/createProject', () => {
    it('should return a successful draft project creation response', (done) => {
        chai.request(server)
            .post('/api/projects/createProject')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({
                "professor": "SEAN",
                "projectType": "Draft",
                "projectDetails": {
                    "project": {
                        "projectName": "Test 2 PROJECT",
                        "posted": "Wed Nov 01 2023 21:10:11 GMT-0400 (Eastern Daylight Time)",
                        "description": "A pretty cool project!",
                        "questions": [
                            "Do you want to do this project?"
                        ],
                        "requirements": [
                            {
                                "requirementType": 1,
                                "requirementValue": "IDK what this is",
                                "required": true
                            }
                        ]
                    }
                }
            })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal('PROJECT_CREATED');
                done();
            });
    });
});

describe('GET /api/projects/getProjects', () => {
    it('should return a successful project retrieval response', (done) => {
        chai.request(server)
            .get('/api/projects/getProjects')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({})
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal("PROJECTS_FOUND");
                expect(res.body.success.projects.draftProjects.projects.length).to.equal(1);
                expect(res.body.success.projects.activeProjects.projects.length).to.equal(1);
                projectID = res.body.success.projects.activeProjects.projects[0]._id;
                draftID = res.body.success.projects.draftProjects.projects[0]._id;
                projectRecordID = res.body.success.projects.activeProjects._id;
                draftRecordID = res.body.success.projects.draftProjects._id;
                done();
            });
    });
});

describe('PUT /api/projects/updateProject', () => {
    it('should return a successful project update response', (done) => {
        chai.request(server)
            .put('/api/projects/updateProject')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({
                "projectID": projectID,
                "projectType": "Active",
                "projectDetails": {
                    "project": {
                        "projectName": "UPDATE",
                        "posted": "Wed Nov 01 2023 21:10:11 GMT-0400 (Eastern Daylight Time)",
                        "description": "UPDATE",
                        "questions": [
                            "Do you want to do this project?"
                        ],
                        "requirements": [
                            {
                                "requirementType": 1,
                                "requirementValue": "IDK what this is",
                                "required": true
                            }
                        ]
                    }
                }
            })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal('PROJECT_UPDATED');
                done();
            });
    });
});

describe('PUT /api/projects/archiveProject', () => {
    it('should return a successful project archive response', (done) => {
        chai.request(server)
            .put('/api/projects/archiveProject')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({
                "projectID": projectID,
            })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal('PROJECT_ARCHIVED');
                done();
            });
    });
});

describe('DELETE /api/projects/deleteProject', () => {
    it('should return a successful project deletion response', (done) => {
        chai.request(server)
            .delete('/api/projects/deleteProject')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({
                "projectID": draftID,
                "projectType": "Draft"
            })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal('PROJECT_DELETED');
                done();
            });
    });
});

describe('GET /api/projects/getProjects', () => {
    it('should return a successful project retrieval response with an archived project and deleted draft', (done) => {
        chai.request(server)
            .get('/api/projects/getProjects')
            .set({ "Authorization": `Bearer ${access_token}` })
            .send({})
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('success');
                expect(res.body.success).to.have.property('status').to.equal(200);
                expect(res.body.success).to.have.property('message').to.equal("PROJECTS_FOUND");
                expect(res.body.success.projects.draftProjects.projects.length).to.equal(0);
                expect(res.body.success.projects.activeProjects.projects.length).to.equal(0);
                expect(res.body.success.projects.archivedProjects.projects[0].projectName).to.equal("UPDATE");
                expect(res.body.success.projects.archivedProjects.projects.length).to.equal(1);
                archiveRecordID = res.body.success.projects.archivedProjects._id;
                done();
            });
    });
});


after(async () => {
    try {
        await User.deleteOne({ _id: removeID });
        await Project.deleteOne({ _id: projectRecordID })
        await Project.deleteOne({ _id: draftRecordID })
        await Project.deleteOne({ _id: archiveRecordID })
    } catch (err) {
        console.error(err);
    }
});
