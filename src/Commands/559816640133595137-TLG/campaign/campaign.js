const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "everyone",
  botPermissions: [],
  data: new Discord.SlashCommandBuilder().setName(name).setDescription("Campaign-related commands."),
};
