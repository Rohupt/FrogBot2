const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    _id: String,
    developerMode: Boolean
});

module.exports = mongoose.model('Config', configSchema, 'config');