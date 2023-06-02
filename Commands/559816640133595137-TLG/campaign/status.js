const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");

module.exports = {
  authority: "moderators",
  botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
  data: new Discord.SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription("Modify the status of the campaign.")
    .addStringOption((o) =>
      o
        .setName("campaign")
        .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
        .setMinLength(4)
        .setMaxLength(45)
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("new_status")
        .setDescription("The new status")
        .setRequired(true)
        .addChoices(
          { name: "Finding players", value: "Finding players" },
          { name: "Waiting for start", value: "Waiting for start" },
          { name: "Running", value: "Running" },
          { name: "Paused", value: "Paused" }
        )
    ),
  async execute(ia) {
    let campArg = ia.options.getString("campaign");
    let status = ia.options.getMember("new_status");
    if (campArg == "-this") campArg = ia.channelId;

    await ia.deferReply();
    let camp = await ia.client.util.findCamp(campArg, campList);
    if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });

    try {
      await CampModel.updateOne({ _id: camp.id }, { $set: { state: status } });
    } catch (e) {
      await ia.editReply({ embeds: [ia.embed.setDescription("Update failed. Please try again later.")] });
      throw e;
    }
    let players = "|";
    camp.players.forEach((p) => (players += ` <@!${p.id}> |`));
    ia.embed
      .setTitle(camp.name)
      .setDescription("Modification completed. Please recheck:")
      .addFields(
        { name: "Type", value: `${isOS ? "OS" : "Full"} / ${camp.isVoice ? "Voice" : "Text"}`, inline: true },
        { name: "State", value: camp.state, inline: true },
        { name: "DM", value: `<@!${camp.DM}>`, inline: true },
        { name: "Roleplay Channel", value: `<#${camp.roleplayChannel}>`, inline: true },
        { name: "Discuss Channel", value: `<#${camp.discussChannel}>`, inline: true },
        { name: "Role", value: `<@&${camp.role}>`, inline: true },
        { name: "Players", value: camp.players.length ? players : "No one yet" },
        { name: "Description", value: camp.description || "None" },
        { name: "Notes", value: camp.notes || "None" }
      );

    await msia.editReply({ embeds: [ia.embed] });
  },
};
