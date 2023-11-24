const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { registerSchema, loginSchema, emailSchema } = require('../helpers/inputValidation/validation');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const moment = require('moment');
const generateRes = require('../helpers/generateJSON');

/*  This function handles the login funciton, should only be used with a POST request
    This funciton takes the login credentials and returns an accesstoken and refresh token
    
    The request body requires the following fields : 
    email (String, the email of the account(might be replaced with username in future)) - password (String, the password of the account)
*/
const login = async (req, res) => {
    try {
        const { error } = loginSchema.validate(req.body);
        if (error) { //validates the request body, and responds with error if there is an error
            res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                errors: error.details,
                original: error._original
            }));
            return;
        } else {
            const user = await User.findOne({ email: req.body.email });

            //check that there exists a user with that email, otherwise sends an error response
            if (user) {
                //Check if the password is correct against the hashed password in the db, otherwise sends error response
                const validatePassword = await bcrypt.compare(req.body.password, user.password);

                if (validatePassword) {
                    //Generate Access and refresh tokens
                    const accessToken = generateAccessToken(user.id, user.email, user.name);
                    const refreshToken = generateRefreshToken(user.id, user.email, user.name);

                    if (await addRefreshToken(user, refreshToken)) { //adds refreshtoken to db
                        res.status(200).json(generateRes(true, 200, "LOGIN_SUCCESS", {
                            accessToken: accessToken,
                            refreshToken: refreshToken,
                        }));
                    } else {
                        res.status(500).json(generateRes(false, 500, "SERVER_ERROR", {}));
                    }
                } else {
                    res.status(403).json(generateRes(false, 403, "INVALID_PASSWORD", {}));
                }
            } else {
                res.status(403).json(generateRes(false, 403, "INVALID_EMAIL", {}));
            }
        }
    } catch (error) {
        console.log(error);
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This Incomplete function handles the account creation, should only be used with a POST request
    This funciton takes the information required to create an account and creates an account in the database. It is still incomplete pending the finalization
    of the account creation frontend, as we will add additional fields. This function should return an access & refresh token and account information upon success 
    
    The request body requires the following fields : 
    email (String, email of account) - name (String, name of user) - password (String, password for the account)
*/
const register = async (req, res) => {
    try {
        const { error } = registerSchema.validate(req.body, { abortEarly: false });
        if (error) { //Validates the request body against the registration schema, otherwise sends an error response
            res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {
                errors: error.details, original: error._original
            }));
            return;
        } else {
            //hash the user's password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.password, salt);

            //create new user instance
            const user = new User({
                email: req.body.email,
                password: hashedPassword,
                name: req.body.name,
                emailConfirmed: false,
                emailToken: uuidv4(),
                security: {
                    tokens: [],
                    passwordReset: {
                        token: null,
                        provisionalPassword: null,
                        expiry: null
                    }
                },
                userType: { //Temporarialy hardcoded, will make every account a faculty account, will be updated in the future
                    Type: req.body.accountType,
                    Confirmed: true,
                },
            });

            //attempt save user
            await user.save();

            //create JWT token
            const access_token = generateAccessToken(user.id, user.email, user.name);

            //create refresh token
            const refreshToken = generateRefreshToken(user.id, user.email, user.name);

            await User.updateOne({ email: user.email }, {
                $push: {
                    'security.tokens': {
                        refreshToken: refreshToken,
                        createdAt: new Date(),
                    },
                },
            });

            await sendEmailConfirmation(user);

            res.status(200).header().json(
                generateRes(true, 200, "REGISTER_SUCCESS", {
                    accessToken: access_token,
                    refreshToken: refreshToken,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                    }
                }));
        }
    } catch (error) {
        let errMessage;

        if (error.keyPattern.email === 1) {
            errMessage = 'EMAIL_EXISTS'
        } else {
            errMessage = err;
        }

        res.status(400).json(generateRes(false, 400, errMessage, {}));
    }
}

/*  This function handles the access token regeneration, should only be used with a POST request
    This function takes a refreshtoken and should respond with an accesstoken when the refresh token is valid
    
    The request body requires the following fields : 
    refreshtoken (String, the refreshtoken that will be used to validate the request/generate new access token)
*/
const token = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;

        try { // Gets the email from the refresh token and validates the refreshtoken against the database
            const decodeRefreshToken = JWT.verify(refreshToken, process.env.SECRET_REFRESH_TOKEN);
            const user = await User.findOne({ email: decodeRefreshToken.email });
            const existingTokens = await user.security.tokens;

            //checking if refresh token is in document
            if (existingTokens.some(token => token.refreshToken === refreshToken)) {
                //generate new access token
                const access_token = generateAccessToken(user.id, user.email, user.name);

                res.status(200).header().json(generateRes(true, 200, "ACCESS_TOKEN_GENERATED", {
                    accessToken: access_token
                }));
            } else {
                res.status(401).json(generateRes(false, 401, "EXPIRED_REFRESH_TOKEN", {}));
            }
        } catch (error) {
            res.status(401).json(generateRes(false, 401, "INVALID_REFRESH_TOKEN", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This function handles the email confirmation, should only be used with a POST request, and requires an accesstoken
    This function takes an email token in the request body and if then attempt to confirm the user's email if the token 
    matches the email token in the database
    
    The request body requires the following fields : 
    emailToken (String, the token that will be used to attempt to validate the email of the account)
*/
const confirmEmailToken = async (req, res) => {
    try {
        const emailToken = req.body.emailToken;

        if (emailToken !== null) { //if there is no email token then do nothing
            const accessToken = req.header('Authorization').split(' ')[1];
            const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

            //check if user exists
            const user = await User.findOne({ email: decodeAccessToken.email });

            //check if email is already confirmed
            if (!user.emailConfirmed) {
                //check if provided email token matches
                if (emailToken === user.emailToken) {
                    await User.updateOne({ email: decodeAccessToken.email }, { $set: { emailConfirmed: true, emailToken: null } })
                    res.status(200).json(generateRes(true, 200, "EMAIL_CONFIRMED", {}));
                } else {
                    res.status(401).json(generateRes(false, 401, "INVALID_EMAIL_TOKEN", {}));
                }
            } else {
                res.status(401).json(generateRes(false, 401, "EMAIL_ALREADY_CONFIRMED", {}));
            }
        } else {
            res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This function handles the reset password requests, should only be used with a POST request
    This function takes the email of the account and password that will replace the user's password. This function doesn't replace the user's password,
    but instead sets up the database with information required to allow a password to be reset, such as password reset token and reset token expiry
    
    The request body requires the following fields : 
    email (String, the email of the account) - provisionalPassword (String, the new password)
*/
const resetPassword = async (req, res) => {
    try {
        if (req.body.provisionalPassword.length >= 6 && req.body.provisionalPassword.length <= 255) {
            //Hash Password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.provisionalPassword, salt);

            //Generate Password Reset Token and expiresIn - 10 minutes
            const passwordResetToken = uuidv4();
            const expiresIn = moment().add(10, 'm').toISOString();

            //Update user with password token, expiry, and provisional password
            await User.findOneAndUpdate({ email: req.body.email }, {
                $set: {
                    'security.passwordReset': {
                        token: passwordResetToken,
                        provisionalPassword: hashedPassword,
                        expiry: expiresIn
                    },
                },
            });
            //sends email to the users notifying them
            await sendPasswordResetConfirmation({ email: req.body.email, passwordResetToken: passwordResetToken })
            res.status(200).json(generateRes(true, 200, "PWD_RESET_EMAIL_SENT", {}));

        } else {
            res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This function handles the reset password functionality, should only be used with a POST request
    This function takes the password reset token and user email. If these are validated, then the password is reset to the provisional password
    set in the passwordReset function.
    
    The request body requires the following fields : 
    email (String, the email of the account) - passwordResetToken (String, token needed to reset the password)
*/
const resetPasswordConfirm = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        //check if passwordResetToken matches the token in the DB
        if (user.security.passwordReset.token === req.body.passwordResetToken) {

            //check if password reset token expired
            if (new Date().getTime() <= new Date(user.security.passwordReset.expiry).getTime()) {
                await User.updateOne({ email: req.body.email }, {
                    $set: { //resets the password reset fields, and sets the password to the new password
                        'password': user.security.passwordReset.provisionalPassword,
                        'security.passwordReset.token': null,
                        'security.passwordReset.provisionalPassword': null,
                        'security.passwordReset.expiry': null,
                    },
                });

                res.status(200).json(generateRes(true, 200, "PWD_RESET_SUCCESS", {}));
            } else {
                //Removing password reset token because expiry  
                await User.updateOne({ email: req.body.email }, {
                    $set: {
                        'security.passwordReset.token': null,
                        'security.passwordReset.provisionalPassword': null,
                        'security.passwordReset.expiry': null,
                    },
                });
                res.status(401).json(generateRes(false, 401, "PWD_TOKEN_EXPIRED", {}));
            }
        } else {
            res.status(401).json(generateRes(false, 401, "INVALID_PWD_TOKEN", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/*  This function handles the emailChange functionality, should only be used with a POST request, and requires a valid access token
    This function takes an emailresetToken and validates it against the database. If it is validated then the email is reset to the provisional email

    The request body requires the following fields : 
    emailResetToken (String, the email reset token of the account) 
*/
const changeEmailConfirm = async (req, res) => {
    try {
        //Decode Access Token
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //get user from email in the access token
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if email exists 
        const existingEmail = await User.findOne({ email: user.security.changeEmail.provisionalEmail });

        if (!existingEmail) {//if the email doesn't already exist sends error response 
            if (user.security.changeEmail.token === req.body.changeEmailToken) { //check that changeEmailToken is correct

                //check that email token isn't expired
                if (new Date().getTime() <= new Date(user.security.changeEmail.expiry).getTime()) {
                    await User.updateOne({ email: decodeAccessToken.email }, {
                        $set: {
                            'email': user.security.changeEmail.provisionalEmail,
                            'security.changeEmail.token': null,
                            'security.changeEmail.provisionalEmail': null,
                            'security.changeEmail.expiry': null,
                        },
                    });
                    res.status(200).json(generateRes(true, 200, "EMAIL_RESET_SUCCESS", {}));
                } else { //Otherwise the email token is expired and the reset token fields should be reset
                    await User.updateOne({ email: decodeAccessToken.email }, {
                        $set: {
                            'security.changeEmail.token': null,
                            'security.changeEmail.provisionalEmail': null,
                            'security.changeEmail.expiry': null,
                        },
                    });
                    res.status(401).json(generateRes(false, 401, "EMAIL_TOKEN_EXPIRED", {}));
                }
            } else {
                res.status(401).json(generateRes(false, 401, "INVALID_EMAIL_TOKEN", {}));
            }
        } else { //if the email already exists remove the emailreset fields
            await User.updateOne({ email: decodeAccessToken.email }, {
                $set: {
                    'security.changeEmail.token': null,
                    'security.changeEmail.expiry': null,
                    'security.changeEmail.provisionalEmail': null,
                }
            });
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
};

/*  This function handles the emailChange requests, should only be used with a POST request, and requires a valid access token
    This function takes an provisionalEmail sets up the database to accept a changeEmailConfirm request. This function does not change the email of the user,
    but instead prepares the database/backend to securely change the email of a user account.

    The request body requires the following fields : 
    provisionalEmail (String, the new email for the account)
*/
const changeEmail = async (req, res) => {
    try {
        const { error } = emailSchema.validate({ email: req.body.provisionalEmail });
        if (!error) {
            //Decode Access Token
            const accessToken = req.header('Authorization').split(' ')[1];
            const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

            //check if new Email Exists
            const emailExists = await User.findOne({ email: req.body.provisionalEmail });

            if (!emailExists) {
                //Generate an email confirmation token
                const changeEmailToken = uuidv4();
                const expiresIn = moment().add(10, 'm').toISOString();

                //update user with email token
                const user = await User.findOneAndUpdate({ email: decodeAccessToken.email }, {
                    $set: {
                        'security.changeEmail': {
                            token: changeEmailToken,
                            provisionalEmail: req.body.provisionalEmail,
                            expiry: expiresIn,
                        },
                    },
                });

                await changeEmailConfirmation({ email: user.email, emailToken: changeEmailToken });
                res.status(200).json(generateRes(true, 200, "CHANGE_EMAIL_SENT", {}));
            } else {
                res.status(400).json(generateRes(false, 400, "EMAIL_EXISTS", {}));
            }
        } else {
            res.status(400).json(generateRes(false, 400, "INPUT_ERROR", {}));
        }
    } catch (error) {
        res.status(400).json(generateRes(false, 400, "BAD_REQUEST", {}));
    }
}

/* Test function, nothing important here */
const test = async (req, res) => {
    try {
        req.user
        res.send("GOOD" + req.user.email);
    }
    catch {
        res.send('Error');
    }
}

//Helper methods

/*  These functions send an email to the user which allow them to confirm their email, reset their password, or change their email assuming that their 
    account is set up to properly handle such a request (and maybe they have a valid access token)
*/
const sendEmailConfirmation = async (user) => {
    let transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Confirmation Email',
        text: `Click link to confirm your email: http://${process.env.FRONT_END_IP}/confirm-email/${user.emailToken}`
    };

    await transport.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        }
    });
}

const sendPasswordResetConfirmation = async (user) => {
    let transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Reset your password',
        text: `Click link to reset your password: http://localhost:9000/reset-password/${user.passwordResetToken}`
    };

    await transport.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        }
    });
};

const changeEmailConfirmation = async (user) => {
    let transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Reset your password',
        text: `Click link to confirm your new email change: http://${process.env.FRONT_END_IP}/confirm-email-change/:${user.emailToken}`
    };

    await transport.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        }
    });
};




// These two function handles the token generation, either accesstoken for accessing api/webapp or refresh token for regenerating an access token
const generateAccessToken = (id, email, uName) => {
    let items = {
        _id: id,
        email: email,
        name: uName,
    }
    return JWT.sign(items, process.env.SECRET_ACCESS_TOKEN, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY })
}

const generateRefreshToken = (id, email, uName) => {
    let items = {
        _id: id,
        email: email,
        name: uName,
    }
    return JWT.sign(items, process.env.SECRET_REFRESH_TOKEN, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY })
}

/*  This function handles the refresh token addition to the database. This function takes a user record and a refreshtoken and adds the refreshtoken to the 
    user's record in the database. 

    Currently, the database only supports having 5 refreshtokens active at a time, so if there is less than 5 in the database the refresh token is added to 
    the existingRefreshTokens array otherwise a token is removed from the array and replaced with the refreshtoken in this function's parameter
*/
const addRefreshToken = async (user, refreshToken) => {
    try {
        const existingRefreshTokens = user.security.tokens;

        //check if there is less than X refresh tokens
        if (existingRefreshTokens.length < 5) {
            await User.updateOne({ email: user.email }, {
                $push: {
                    'security.tokens': {
                        refreshToken: refreshToken,
                        createdAt: new Date()
                    },
                },
            });
        } else {
            //Otherwise remove the last token 
            await User.updateOne({ email: user.email }, {
                $pull: {
                    'security.tokens': {
                        _id: existingRefreshTokens[0]._id,
                    },
                },
            });

            //push the new token
            await User.updateOne({ email: user.email }, {
                $push: {
                    'security.tokens': {
                        refreshToken: refreshToken,
                        createdAt: new Date(),
                    },
                },
            });
        }
        return true;
    } catch (error) {
        return false;
    }
}


module.exports = {
    test, register, token,
    confirmEmailToken, login,
    resetPassword, resetPasswordConfirm,
    changeEmail, changeEmailConfirm
};