const mongoose = require('mongoose');

const Applications = new mongoose.Schema({
    user: {
        type: String,
        required: true,
    },
    applications: [
        {
            questions: [{
                question: String,
                answer: String
            }],
            answers: [{
                question: String,
                answer: String
            }],
            opportunityRecordId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            opportunityId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
            },
            status: {
                type: String,
                required: true
            }
        }
    ]
})

module.exports = mongoose.model('application', Applications);