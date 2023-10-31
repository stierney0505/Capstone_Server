const mongoose = require('mongoose');

const ApplicationOpp = new mongoose.Schema({
    user: {
        type: String,
        required: true,
    },
    questions: [{
        question: String,
        answer: String
    }],
    opportunityId: {
        type: mongoose.ObjectId,
        required: true
    },
    status: {
        type: Boolean,
        required: true
    }
})

module.exports = mongoose.model('User', userSchema);