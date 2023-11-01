const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    projects: [
        {type: mongoose.Schema.Types.ObjectId, ref: 'Project'}
    ],
    groupType: {
        type: Number // can be used to set if active/archived/draft
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId
    }
})

module.exports = mongoose.model('ProjectGroup', userSchema);