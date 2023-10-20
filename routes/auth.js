const express = require('express');
const authController = require('../controllers/authenicate');

//API MIDDLEWARE
const verifyToken = require('../helpers/verifyToken')
const rateLimiter = require('../helpers/rateLimiter');


//Router initialisation
const router = express.Router();

//routes
router.get('/auth/test', [rateLimiter(50, 10), verifyToken], authController.test);

//POST REGISTER
router.post('/register', rateLimiter(10, 10), authController.register);

//POST TOKEN
router.post('/auth/token', authController.token);

//POST Confirm Email!
router.post('/confirmEmail', verifyToken, authController.confirmEmailToken);

//POST Login
router.post('/login', authController.login);

//Post Reset Password request
router.post('/resetPassword', authController.resetPassword);

//Post Confirm Reset Password
router.post('/confirmResetPassword', authController.resetPasswordConfirm);

//POST Change Email
router.post('/changeEmail', authController.changeEmail);

//POST Confirm Change Email
router.post('/changeEmailConfirm', authController.changeEmailConfirm);

module.exports = router;