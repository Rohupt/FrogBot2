const mongoose = require('mongoose');

const CampSchema = new mongoose.Schema({
    name: {type: String, required: true},
    isOS: {type: Boolean, required: true},
    isVoice: {type: Boolean, required: true, default: false},
    DM: String,
    role: {type: String, required: true},
    state: {type: String, required: true},
    description: {type: String, default: ''},
    notes: {type: String, default: ''},
    roleplayChannel: String,
    discussChannel: String,
    players: [{
        id: {type: String, required: true},
        sheet: {type: String, default: ''},
        token: {type: String, default: ''}
    }]
});

module.exports = mongoose.model('Camp', CampSchema, 'camps');