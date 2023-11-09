const express = require('express');
const facultyProjects = require('../controllers/facultyProjects');

//API MIDDLEWARE
const verifyToken = require('../helpers/verifyToken')
const rateLimiter = require('../helpers/rateLimiter');


//Router initialisation
const router = express.Router();

//routes

//POST Create Project 
router.post('/createProject', verifyToken, facultyProjects.createProject);

//DELETE Delete Project
router.delete('/deleteProject', verifyToken, facultyProjects.deleteProject);

router.get('/getProjects', verifyToken, facultyProjects.getProjects);

module.exports = router;