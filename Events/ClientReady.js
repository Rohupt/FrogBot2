const Discord = require('discord.js');
const mongoose = require('@util/mongoose.js');

module.exports = {
    once: true,
    async execute(client) {
        await mongoose(client);
        client.log('READY', `(${process.uptime()} s) Connected as ${client.user.tag}`);
        client.developerMode = (await client.util.config()).developerMode;
        client.user.setActivity(`${client.developerMode ? 'the dev only' : 'everyone'}`, {type: Discord.ActivityType.Listening});
    }
};