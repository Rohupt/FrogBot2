const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "developer",
  botPermissions: [],
  data: new Discord.SlashCommandBuilder()
    .setName(name)
    .setDescription("Toggle the developer mode.")
    .addNumberOption((o) =>
      o
        .setName("switch")
        .setDescription("Turn on or off or toggle. Omit to show.")
        .setRequired(false)
        .addChoices({ name: "Toggle", value: -1 }, { name: "Off", value: 0 }, { name: "On", value: 1 })
    ),
  async execute(ia) {
    await ia.deferReply();
    let sw = ia.options.getNumber("switch");
    if (sw == null) {
      return await ia.editReply({ embeds: [ia.embed.setDescription(`Developer Mode is \`${ia.client.developerMode ? "ON" : "OFF"}\`.`)] });
    } else {
      ia.client.developerMode = sw == -1 ? !ia.client.developerMode : !!sw;
      await ia.client.util.setConfig("developerMode", ia.client.developerMode);
      ia.client.user.setActivity(`${ia.client.developerMode ? "the dev only" : "everyone"}`, { type: Discord.ActivityType.Listening });
      return await ia.editReply({ embeds: [ia.embed.setDescription(`Developer Mode is now \`${ia.client.developerMode ? "ON" : "OFF"}\`.`)] });
    }
  },
};
