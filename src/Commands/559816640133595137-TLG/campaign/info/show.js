const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "everyone",
  botPermissions: [],
  data: new Discord.SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription("Show campaign information")
    .addStringOption((o) =>
      o
        .setName("campaign")
        .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
        .setMinLength(4)
        .setMaxLength(45)
        .setRequired(true)
    ),
  async execute(ia) {
    let tlg = ia.client.util.reloadFile("@data/tlg.json");
    let campArg = ia.options.getString("campaign");
    if (campArg == "-this") campArg = ia.channelId;

    await ia.deferReply();
    let camp = await ia.client.util.findCamp(campArg);
    if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });

    var players = "|";
    camp.players.forEach((p) => (players += ` <@!${p.id}> |`));
    ia.embed
      .setTitle(camp.name)
      .addFields(
        { name: "Type", value: `${camp.isOS ? "OS" : "Full"} / ${camp.isVoice ? "Voice" : "Text"}`, inline: true },
        { name: "State", value: camp.state, inline: true },
        { name: "DM", value: `<@!${camp.DM}>`, inline: true },
        { name: "Roleplay Channel", value: `<#${camp.roleplayChannel}>`, inline: true },
        { name: "Discuss Channel", value: `<#${camp.discussChannel}>`, inline: true },
        { name: "Role", value: `<@&${camp.role}>`, inline: true },
        { name: "Players", value: camp.players.length ? players : "No one yet" },
        { name: "Description", value: camp.description || "None" },
        { name: "Notes", value: camp.notes || "None" }
      );
    return await ia.editReply({ embeds: [ia.embed] });
  },
};
