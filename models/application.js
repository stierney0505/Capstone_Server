const mongoose = require('mongoose');

const ApplicationOpp = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    questions: [{
        question: String,
        answer: String
    }],
    opportunityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    status: {
        type: Boolean,
        required: true
    }
})

module.exports = mongoose.model('Application', userSchema);