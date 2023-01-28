const mongoose = require("mongoose");
const mongoPath = process.env.MONGO;

module.exports = async (client) => {
    try {
        mongoose.set("strictQuery", true);
        await mongoose.connect(mongoPath, { keepAlive: true }, (err) => {
            if (err) throw err;
            client.log("READY", `(${process.uptime().toFixed(6)} s) Connected to database`);
        });
    } catch (error) {
        client.error(error);
    }

    return mongoose;
};
