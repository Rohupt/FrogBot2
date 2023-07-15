const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");

function validURL(str) {
  var pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
      "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
      "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  ); // fragment locator
  return !!pattern.test(str);
}

module.exports = {
  authority: "dungeonmasters",
  botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
  data: new Discord.SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription("Modify information about the players.")
    .addStringOption((o) =>
      o
        .setName("campaign")
        .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
        .setMinLength(4)
        .setMaxLength(45)
        .setRequired(true)
    )
    .addUserOption((o) => o.setName("player").setDescription("The player whose info to be edited. Omit to edit your own info."))
    .addStringOption((o) => o.setName("sheet").setDescription("Link to the player sheet"))
    .addStringOption((o) => o.setName("token").setDescription("Link to the player token")),
  async execute(ia) {
    let tlg = ia.client.util.reloadFile("@data/tlg.json");
    let campArg = ia.options.getString("campaign");
    if (campArg == "-this") campArg = ia.channelId;

    await ia.deferReply();
    let camp = await ia.client.util.findCamp(campArg);
    if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });
    if (ia.user.id != camp.DM && !ia.member.roles.cache.some((r) => r.id == tlg.modRoleID) && !ia.member.permissions.has(PFB.Administrator)) {
      return await ia.editReply({
        embeds: [ia.embed.setDescription("You are not the Dungeon Master of this camp, nor a moderator.\nYou cannot use this command.")],
      });
    }

    let player = ia.options.getMember("player") ?? ia.member;
    let campPlayer = camp.players.find((p) => p.id == player.id);
    if (!campPlayer) return await ia.editReply({ embeds: [ia.embed.setDescription("The member is not a player of this campaign.")] });
    if (ia.member.id != player.id && !ia.member.roles.cache.some((r) => r.id == tlg.modRoleID) && !ia.member.permissions.has(PFB.Administrator))
      return await ia.editReply({ embeds: [ia.embed.setDescription("You cannot set the links for another player.")] });

    let sheet = ia.options.getString("sheet");
    let token = ia.options.getString("token");

    if (sheet)
      if (validURL(sheet)) campPlayer.sheet = sheet;
      else return await ia.editReply({ embeds: [ia.embed.setDescription("The sheet link is invalid.")] });

    if (token)
      if (validURL(sheet)) campPlayer.token = token;
      else return await ia.editReply({ embeds: [ia.embed.setDescription("The token link is invalid.")] });

    try {
      await CampModel.updateOne({ _id: camp.id }, { players: camp.players });
    } catch (e) {
      await ia.editReply({ embeds: [ia.embed.setDescription("Update failed. Please try again later.")] });
      throw e;
    }
    ia.embed
      .setTitle(camp.name)
      .setDescription("Completed. Please recheck:")
      .addFields([
        { name: "Player", value: `${player}` },
        { name: "Sheet link", value: campPlayer.sheet ? `[[Click here]](${campPlayer.sheet})` : "None", inline: true },
        { name: "Token link", value: campPlayer.token ? `[[Click here]](${campPlayer.token})` : "None", inline: true },
      ]);
    if (campPlayer.token) ia.embed.setImage(campPlayer.token);

    await ia.editReply({ embeds: [ia.embed] });
  },
};
