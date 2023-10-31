const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: mongoose.ObjectId,
        required: true
    },
    projects: [
        {
            
        }
    ]
})

module.exports = mongoose.model('ActiveProjects', userSchema);