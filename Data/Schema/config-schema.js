const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
    _id: String,
    developerMode: Boolean,
    archiveCat: String,
});

let Config;
try {
    Config = mongoose.model("Config");
} catch (err) {
    Config = mongoose.model("Config", ConfigSchema, "config");
}
module.exports = Config;