const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors')

app.set('trust proxy', '127.0.0.1');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());
require('dotenv').config();

//routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const applicationRoutes = require('./routes/applicationRoutes');

//Endpoints
app.use('/api', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/applications', applicationRoutes);

const port = process.env.PORT || 5000;

async function dbConnect() {
    await mongoose.connect(`${process.env.DB_PROTOCOL}://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}?${process.env.DB_PARAMS}`,
    {
        autoIndex: true,
    }).then(() => {
        app.listen(port, () => {
            console.log('Listening on port ' + port);
        })
    }).catch((err) => {
        console.log(err);
    });
}

dbConnect();

process.on('SIGINT', () => {
    mongoose.connection.close();
    console.log('Mongoose disconnected on app termination');
    process.exit(0);
});

module.exports = app;

