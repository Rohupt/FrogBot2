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
    .setDescription("Add players.")
    .addStringOption((o) =>
      o
        .setName("campaign")
        .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
        .setMinLength(4)
        .setMaxLength(45)
        .setRequired(true)
    )
    .addUserOption((o) => o.setName("p1").setDescription("The player to be added.").setRequired(true))
    .addUserOption((o) => o.setName("p2").setDescription("The player to be added."))
    .addUserOption((o) => o.setName("p3").setDescription("The player to be added."))
    .addUserOption((o) => o.setName("p4").setDescription("The player to be added."))
    .addUserOption((o) => o.setName("p5").setDescription("The player to be added."))
    .addUserOption((o) => o.setName("p6").setDescription("The player to be added.")),
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

    let addList = [],
      addedList = "|",
      mem;
    for (let i = 1; i <= 6; i++) if (!!(mem = ia.options.getMember(`p${i}`)) && !camp.players.find((p) => p.id == mem.id)) addList.push(mem);

    for await (mem of addList) {
      await Promise.all([mem.roles.add(camp.role), mem.roles.remove(tlg.noCampRoleID)]);
      camp.players.push({ id: mem.id, sheet: "", token: "" });
      addedList += ` ${mem} |`;
    }

    try {
      await CampModel.updateOne({ _id: camp.id }, { $set: { players: camp.players } });
    } catch (e) {
      await ia.editReply({ embeds: [ia.embed.setDescription("Update failed. Please try again later.")] });
      throw e;
    }

    let resultField = "|";
    camp.players.forEach((p) => (resultField += ` <@!${p.id}> |`));
    ia.embed
      .setTitle(camp.name)
      .setDescription("Modification completed. Please check:")
      .addFields([
        { name: "Players added", value: addList.length ? addedList : "None" },
        { name: "Current players list", value: camp.players.length ? resultField : "None" },
      ]);

    await ia.editReply({ embeds: [ia.embed] });
  },
};
