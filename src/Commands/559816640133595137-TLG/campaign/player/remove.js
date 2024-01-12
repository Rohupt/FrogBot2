const Discord = require("discord.js");
const { sep } = require("path");
const _ = require("lodash");
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
    .addUserOption((o) => o.setName("p1").setDescription("The player to be removed.").setRequired(true))
    .addUserOption((o) => o.setName("p2").setDescription("The player to be removed."))
    .addUserOption((o) => o.setName("p3").setDescription("The player to be removed."))
    .addUserOption((o) => o.setName("p4").setDescription("The player to be removed."))
    .addUserOption((o) => o.setName("p5").setDescription("The player to be removed."))
    .addUserOption((o) => o.setName("p6").setDescription("The player to be removed.")),
  async execute(ia) {
    let tlg = ia.client.util.reloadFile("@data/tlg.json");
    let campArg = ia.options.getString("campaign");
    if (campArg == "-this") campArg = ia.channelId;

    await ia.deferReply();
    const camp = await ia.client.util.findCamp(campArg);
    if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });
    if (ia.user.id != camp.DM && !ia.member.roles.cache.some((r) => r.id == tlg.modRoleID) && !ia.member.permissions.has(PFB.Administrator)) {
      return await ia.editReply({
        embeds: [ia.embed.setDescription("You are not the Dungeon Master of this camp, nor a moderator.\nYou cannot use this command.")],
      });
    }

    const rmvList = await Promise.all(
      [...ia.options.resolved.members.filter((mem) => camp.players.find((p) => p.id == mem.id)).values()].map((mem) => mem.fetch(true))
    );
    const rmvdList = `| ${rmvList.join(" | ")} |`;
    rmvList.forEach((mem) =>
      camp.players.splice(
        camp.players.findIndex((p) => p.id == mem.id),
        1
      )
    );
    const campRoleMaxPos = (await ia.guild.roles.fetch(tlg.noCampRoleID)).position;
    const campRoleMinPos = (await ia.guild.roles.fetch(tlg.advLeagueRoleCatID)).position;

    while (true) {
      const promises = [];
      promises.push(...rmvList.filter((mem) => mem.roles.cache.has(camp.role)).map((mem) => mem.roles.remove(camp.role)));
      promises.push(
        ...rmvList
        .filter((mem) => !(mem.roles.cache.some((r) => r.position > campRoleMinPos && r.position <= campRoleMaxPos)))
        .map((mem) => mem.roles.add(tlg.noCampRoleID))
        );
      if (promises.length == 0) break;
      rmvList.length = 0;
      rmvList.push(..._.uniqBy(_.compact(await Promise.all(promises)), (e) => e.id));
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
        { name: "Players removed", value: rmvList.length ? rmvdList : "None" },
        { name: "Current players list", value: camp.players.length ? resultField : "None" },
      ]);

    await ia.editReply({ embeds: [ia.embed] });
  },
};
