const mongoose = require("mongoose");

const ServerSchema = new mongoose.Schema({
  _id: String,
  prefix: {
    type: String,
    required: true,
    default: process.env.DEFAULT_PREFIX,
  },
});

let ServerModel;
try {
  ServerModel = mongoose.model("Server");
} catch (err) {
  ServerModel = mongoose.model("Server", ServerSchema, "servers");
}
module.exports = ServerModel;
