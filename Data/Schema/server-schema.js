const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    _id: String,
    prefix: {
        type: String,
        required: true,
        default: process.env.DEFAULT_PREFIX
    }
});

module.exports = mongoose.model('Server', serverSchema, 'servers');