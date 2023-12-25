const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "moderators",
  botPermissions: [],
  data: new Discord.SlashCommandBuilder()
    .setName(name)
    .setDescription("Grant entry for a new member")
    .addUserOption((o) => o.setName("user").setDescription("The user to be granted entry.").setRequired(true))
    .addBooleanOption((o) => o.setName("is_bot").setDescription("Whether the user is a bot.").setRequired(false)),
  async execute(ia) {
    await ia.deferReply();
    const tlg = ia.client.util.reloadFile("@data/tlg.json");
    const entryChannel = ia.guild.channels.resolve(tlg.newMemberChannel);
    const user = ia.options.getMember("user");
    const isBot = ia.options.getBoolean("is_bot", false) ?? false;
    if (isBot) {
      await Promise.all([user.roles.remove(tlg.waitingRoleID), user.roles.add(tlg.botRoleID)]);
      return await ia.editReply({ embeds: [ia.embed.setDescription(`Granted entry to the bot ${user}.`)] });
    } else {
      await Promise.all([user.roles.remove(tlg.waitingRoleID), user.roles.add(tlg.memberRoleID, tlg.noCampRoleID)]);
      await entryChannel.send(`Chào mừng ${user} đến với Thần Long Giáo! Mời <@&${tlg.receptionistRoleID}> ra đón tiếp.`);
      return await ia.editReply({ embeds: [ia.embed.setDescription(`Granted entry to ${user}.`)] });
    }
  },
};
