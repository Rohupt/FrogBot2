const Discord = require("discord.js");
const { sep } = require("path");
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "everyone",
  botPermissions: [],
  data: new Discord.SlashCommandSubcommandGroupBuilder().setName(name).setDescription("View and edit campaign information"),
};
