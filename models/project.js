const mongoose = require('mongoose');

const researchOpp = new mongoose.Schema({
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    applications: [
        {
            application: {
                type: mongoose.Schema.Types.ObjectId, ref: 'Application'
            }
        }
    ],
    posted: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        required: true,
        default: "No description provided"
    },
    questions: [String],
    requirements: [
        {requirementType: Number, requirementValue: String, required: Boolean}
    ]
})

module.exports = mongoose.model('Project', researchOpp);