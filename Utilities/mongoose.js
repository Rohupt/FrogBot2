const mongoose = require('mongoose');
const mongoPath = process.env.MONGO;

module.exports = async (client) => {
    try {
        await mongoose.connect(mongoPath, {
            keepAlive: true,
        }, (err) => {
            if (err) throw err;
            client.log('READY', `(${process.uptime()} s) Connected to database.`);
        });
    } catch (error) {
        client.error(error);
    }

    return mongoose;
}