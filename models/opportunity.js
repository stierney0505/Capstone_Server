const mongoose = require('mongoose');

const researchOpp = new mongoose.Schema({
    professor: {
        type: String,
        required: true,
    },
    applications: [
        {applicationId: mongoose.ObjectId}
    ],
    posted: {
        type: Date,
        required: true
    },
    description: {
        type: String
    },
    questions: [String],
    requirements: [
        {requirementType: Number, requirementValue: String}
    ]
})

module.exports = mongoose.model('Opportunities', researchOpp);