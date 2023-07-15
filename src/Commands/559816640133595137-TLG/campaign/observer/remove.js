const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");

module.exports = {
  authority: "dungeonmasters",
  botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
  data: new Discord.SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription("Remove players.")
    .addStringOption((o) =>
      o
        .setName("campaign")
        .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
        .setMinLength(4)
        .setMaxLength(45)
        .setRequired(true)
    )
    .addUserOption((o) => o.setName("o1").setDescription("The observer to be removed.").setRequired(true))
    .addUserOption((o) => o.setName("o2").setDescription("The observer to be removed."))
    .addUserOption((o) => o.setName("o3").setDescription("The observer to be removed."))
    .addUserOption((o) => o.setName("o4").setDescription("The observer to be removed."))
    .addUserOption((o) => o.setName("o5").setDescription("The observer to be removed."))
    .addUserOption((o) => o.setName("o6").setDescription("The observer to be removed.")),
  async execute(ia) {
    let tlg = ia.client.util.reloadFile("@data/tlg.json");
    let campArg = await ia.options.getString("campaign");
    if (campArg == "-this") campArg = ia.channelId;

    await ia.deferReply();
    let camp = await ia.client.util.findCamp(campArg);
    if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });
    if (ia.user.id != camp.DM && !ia.member.roles.cache.some((r) => r.id == tlg.modRoleID) && !ia.member.permissions.has(PFB.Administrator)) {
      return await ia.editReply({
        embeds: [ia.embed.setDescription("You are not the Dungeon Master of this camp, nor a moderator.\nYou cannot use this command.")],
      });
    }

    let rmvdList = "|",
      mem;
    const rpCh = ia.guild.channels.resolve(camp.roleplayChannel),
      dcCh = ia.guild.channels.resolve(camp.discussChannel);
    for (let i = 1; i <= 6; i++)
      if (!!(mem = ia.options.getMember(`o${i}`))) {
        await Promise.all([rpCh.permissionOverwrites.delete(mem.id), dcCh.permissionOverwrites.delete(mem.id)]);
        rmvdList += ` ${mem} |`;
      }

    ia.embed
      .setTitle(camp.name)
      .setDescription("Modification completed. Please check:")
      .addFields([{ name: "Observers emoved", value: rmvdList != "|" ? rmvdList : "None" }]);

    await ia.editReply({ embeds: [ia.embed] });
  },
};
