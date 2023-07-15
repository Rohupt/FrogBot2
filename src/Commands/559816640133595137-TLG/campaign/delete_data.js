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
    .setDescription("Delete a camp")
    .addStringOption((o) => o.setName("campaign").setDescription("FULL name of the camp to archive").setRequired(true)),
  async execute(ia) {
    await ia.deferReply();
    let campArg = ia.options.getString("campaign", true);
    let camp = await ia.client.util.findCamp(campArg, null, true);
    if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please provide the full name." });

    await CampModel.deleteOne({ _id: camp.id });
    // let reportChannel = ia.channel || ia.author.dmChannel || await ia.author.createDM();

    await ia.editReply({ embeds: [ia.embed.setDescription(`Campaign data deleted.`)] });
  },
};
