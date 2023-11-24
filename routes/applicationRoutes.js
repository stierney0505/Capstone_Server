const express = require('express');
const applications = require('../controllers/studentApplications');

//API MIDDLEWARE
const verifyToken = require('../helpers/verifyToken')
const rateLimiter = require('../helpers/rateLimiter');


//Router initialisation
const router = express.Router();

//routes

//POST Create Application 
router.post('/createApplication', verifyToken, applications.createApplication);

//POST Create Project 
router.delete('/deleteApplication', verifyToken, applications.deleteApplication);

//GET Get Applications
router.get('/getApplications', verifyToken, applications.getApplications);


module.exports = router;