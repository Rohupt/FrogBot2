const Discord = require("discord.js");
const mongoose = require("@util/mongoose.js");

module.exports = {
    once: true,
    async execute(client) {
        await Promise.all([mongoose(client), client.refreshCommands(), client.util.cacheCamps(client)]);
        client.log("READY", `(${process.uptime().toFixed(6)} s) Connected as ${client.user.tag}`);
        client.developerMode = (await client.util.config()).developerMode;
        client.user.setActivity(`${client.developerMode ? "the dev only" : "everyone"}`, { type: Discord.ActivityType.Listening });
    },
};
