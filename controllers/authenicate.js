const User = require('../models/user');
const JWT = require('jsonwebtoken');
const { registerSchema, loginSchema } = require('../helpers/validation');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const moment = require('moment');


const login = async (req, res) => {
    try {
        const { error } = loginSchema.validate(req.body);

        if (error) {
            res.status(400).json({
                status: 400,
                message: 'Input Error',
                errors: error.details,
                original: error._original
            });
        } else {
            const user = await User.findOne({ email: req.body.email });

            //check that the email is correct
            if (user) {
                //Check if the password is correct
                const validatePassword = await bcrypt.compare(req.body.password, user.password);

                if (validatePassword) {
                    //Generate Access and refresh tokens
                    const accessToken = generateAccessToken(user.id, user.email);
                    const refreshToken = generateRefreshToken(user.id, user.email);

                    if (await addRefreshToken(user, refreshToken)) {
                        res.status(200).json({
                            success: {
                                status: 200,
                                message: "Login Success",
                                accessToken: accessToken,
                                refreshToken: refreshToken
                            }
                        })
                    } else {
                        res.status(500).json({ error: { status: 500, message: 'Server Error' } });
                    }
                } else {
                    res.status(403).json({ error: { status: 403, message: "Invalid password" } });
                }
            } else {
                res.status(403).json({ error: { status: 403, message: "Invalid email" } });
            }
        }
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: { status: 400, message: "Bad Request" } });
    }
}


const register = async (req, res) => {
    try {
        const { error } = registerSchema.validate(req.body, { abortEarly: false });

        if (error) {
            res.status(400).json({ status: 400, message: 'Input_Error', errors: error.details, original: error._original });
        } else {
            //hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.password, salt);

            //create new user instance
            const user = new User({
                email: req.body.email,
                password: hashedPassword,
                emailConfirmed: false,
                emailToken: uuidv4(),
                security: {
                    tokens: [],
                    passwordReset: {
                        token: null,
                        provisionalPassword: null,
                        expiry: null
                    }
                }
            });

            //attempt save user
            await user.save();

            //create JWT token
            const access_token = generateAccessToken(user.id, user.email);

            //create refresh token
            const refreshToken = generateRefreshToken(user.id, user.email);

            await User.updateOne({ email: user.email }, {
                $push: {
                    'security.tokens': {
                        refreshToken: refreshToken,
                        createdAt: new Date(),
                    },
                },
            });

            await sendEmailConfirmation(user);

            res.status(200).header().json({
                success: {
                    status: 200,
                    message: 'REGISTER_SUCCESS',
                    accessToken: access_token,
                    refreshToken: refreshToken,
                    user: {
                        id: user.id,
                        email: user.email,
                    }
                }
            });
        }
    } catch (error) {
        let errMessage;

        if (error.keyPattern.email === 1) {
            errMessage = 'EMAIL_EXISTS'
        } else {
            errMessage = err;
        }

        res.status(400).json({ error: { status: 400, message: errMessage } })
    }
}

const token = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;

        //verify that the token is valid
        try {
            const decodeRefreshToken = JWT.verify(refreshToken, process.env.SECRET_REFRESH_TOKEN);
            const user = await User.findOne({ email: decodeRefreshToken.email });
            const existingTokens = await user.security.tokens;

            //checking if refresh token is in document
            if (existingTokens.some(token => token.refreshToken === refreshToken)) {
                //generate new access token
                const access_token = generateAccessToken(user.id, user.email);

                res.status(200).header().json({
                    success: {
                        status: 200,
                        message: 'Access_Token_Generated',
                        accessToken: access_token
                    },
                });
            } else {
                res.status(401).json({ error: { status: 401, message: 'Invalid Refresh Token' } });
            }

        } catch (error) {
            res.status(401).json({ error: { status: 401, message: 'Invalid Refresh Token' } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: 'Bad Request' } });
    }
}


const confirmEmailToken = async (req, res) => {
    try {
        const emailToken = req.body.emailToken;

        if (emailToken !== null) {
            const accessToken = req.header('Authorization').split(' ')[1];
            const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

            //check if user exists
            const user = await User.findOne({ email: decodeAccessToken.email });

            //check if email is already confirmed
            if (!user.emailConfirmed) {
                //check if provided email token matches
                if (emailToken === user.emailToken) {
                    await User.updateOne({ email: decodeAccessToken.email }, { $set: { emailConfirmed: true, emailToken: null } })
                    res.status(200).json({ success: { status: 200, message: "Email Confirmed" } });
                } else {
                    res.status(401).json({ error: { status: 401, message: "Invalid email token" } });
                }
            } else {
                res.status(401).json({ error: { status: 401, message: "Email already confirmed" } });
            }
        } else {
            res.status(400).json({ error: { status: 400, message: "Bad request" } });
        }

    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "Bad Request" } });
    }
}

//body request includes provisionalpassword and email
const resetPassword = async (req, res) => {
    try {
        if (req.body.provisionalPassword.length >= 6 && req.body.provisionalPassword.length <= 255) {
            //Hash Password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(req.body.provisionalPassword, salt);

            //Generate Password Reset Token
            const passwordResetToken = uuidv4();
            const expiresIn = moment().add(10, 'm').toISOString();

            //Update user with password token
            const user = await User.findOneAndUpdate({ email: req.body.email }, {
                $set: {
                    'security.passwordReset': {
                        token: passwordResetToken,
                        provisionalPassword: hashedPassword,
                        expiry: expiresIn
                    },
                },
            });

            await sendPasswordResetConfirmation({ email: req.body.email, passwordResetToken: passwordResetToken })
            res.status(200).json({ success: { status: 200, message: "Password Reset Email Sent" } })

        } else {
            res.status(400).json({ error: { status: 400, message: "Password input error" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "Bad Request" } });
    }
}

const resetPasswordConfirm = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        //check if passwordResetToken matches the token in the DB
        if (user.security.passwordReset.token === req.body.passwordResetToken) {

            //check if password reset token expired
            if (new Date().getTime() <= new Date(user.security.passwordReset.expiry).getTime()) {
                await User.updateOne({ email: req.body.email }, {
                    $set: {
                        'password': user.security.passwordReset.provisionalPassword,
                        'security.passwordReset.token': null,
                        'security.passwordReset.provisionalPassword': null,
                        'security.passwordReset.expiry': null,
                    },
                });

                res.status(200).json({ success: { status: 200, message: "Password Reset Success" } });
            } else {
                //Removing password reset token because expiry  
                await User.updateOne({ email: req.body.email }, {
                    $set: {
                        'security.passwordReset.token': null,
                        'security.passwordReset.provisionalPassword': null,
                        'security.passwordReset.expiry': null,
                    },
                });
                res.status(401).json({ error: { status: 401, message: "Password reset token expired" } });
            }
        } else {
            res.status(401).json({ error: { status: 401, message: "Invalid password reset token" } });
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "Bad Request" } });
    }
}


const changeEmailConfirm = async (req, res) => {
    try {
        //Decode Access Token
        const accessToken = req.header('Authorization').split(' ')[1];
        const decodeAccessToken = JWT.verify(accessToken, process.env.SECRET_ACCESS_TOKEN);

        //get user
        const user = await User.findOne({ email: decodeAccessToken.email });

        //check if email exists
        const existingEmail = await User.findOne({ email: user.security.changeEmail.provisionalEmail });

        if (!existingEmail) {//if the email doesn't already exist
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
                    res.status(200).json({ success: { status: 200, message: "Email Change Success" } });
                } else {
                    res.status(401).json({ error: { status: 401, message: "Email Token Expired" } });
                }
            } else {
                res.status(401).json({ error: { status: 401, message: "Invalid Email Token" } });
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
        res.status(400).json({ error: { status: 400, message: "Bad Request" } });
    }
};


const changeEmail = async (req, res) => {
    try {
        if (validation.email.validate({ email: req.body.provisionalEmail })) {
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

                await changeEmailConfirmation({email: user.email, emailToken: changeEmailToken});
                res.status(200).json({success: {status: 200, message: "Change Email Sent"}});
            } else {
                res.status(400).json({error: {status: 400, message: "Email Already Registered"}});
            }
        } else { 
            res.status(400).json({error: {status: 400, message: "Provided Email Invalid"}});
        }
    } catch (error) {
        res.status(400).json({ error: { status: 400, message: "Bad Request" } });
    }
}


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

//Email Helper Methods
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
        text: `Click link to confirm your email: http://localhost:9000/confirm-email/${user.emailToken}`
    };

    await transport.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(info);
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
        } else {
            console.log(info);
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
        text: `Click link to confirm your new email change: http://localhost:9000/confirm-email-change/${user.emailToken}`
    };

    await transport.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log(info);
        }
    });
};




//Token Helper Methods
const generateAccessToken = (id, email, uName) => {
    let items = {
        _id: id,
        email: email,
    }
    return JWT.sign(items, process.env.SECRET_ACCESS_TOKEN, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY })
}

const generateRefreshToken = (id, email, uName) => {
    let items = {
        _id: id,
        email: email,
    }
    return JWT.sign(items, process.env.SECRET_REFRESH_TOKEN, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY })
}

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