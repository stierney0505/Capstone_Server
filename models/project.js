const mongoose = require('mongoose');

const researchOpp = new mongoose.Schema({
    type: {
        type: String,
        required: true,
    },
    professor: {
        type: String,
        required: true,
    },
    projects: [{
        projectName: {
            type: String,
            required: true
        },
        professorId: {
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
        archived: {
            type: Date,
            required: false
        },
        description: {
            type: String,
            required: true,
            default: "No description provided"
        },
        questions: [String],
        requirements: [
            { requirementType: Number, requirementValue: String, required: Boolean }
        ]
    }]
})

module.exports = mongoose.model('Project', researchOpp);