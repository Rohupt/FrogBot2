const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "everyone",
  botPermissions: [],
  data: new Discord.SlashCommandBuilder()
    .setName(name)
    .setDescription("Register DnDBeyond subscription")
    .addStringOption((o) =>
      o
        .setName("duration")
        .setDescription("Duration of the subscription")
        .setRequired(true)
        .addChoices(
          { name: "1 month (VND 60000)", value: "1 month" },
          { name: "3 months (VND 160000)", value: "3 months" },
          { name: "6 months (VND 290000)", value: "6 months" },
          { name: "12 months (VND 520000)", value: "12 months" }
        )
    ),
  async execute(ia) {
    await ia.deferReply();
    let beyondChannel = ia.client.util.channel(ia.guild, ia.client.data.tlg.beyondChannel);
    let subsTime = ia.options.getString("duration");

    let price = subsTime == "1 month" ? 60000 : subsTime == "3 months" ? 160000 : subsTime == "6 months" ? 290000 : subsTime == "12 months" ? 520000 : null;
    if (ia.member.roles.cache.find((r) => r.id == "634967372976881664")) price = Math.round((price / 1000) * 0.9) * 1000;
    let messageToAdmins = `<@!${ia.member.id}> registered for **${subsTime}** of DnDBeyond subscription.`;
    let messageToUser =
      `The subscription admins are informed.\n` +
      `Now please transfer **VND ${price}** to the account written in <#564383464502067201> ` +
      `and send the receipt screenshot to <@!232380046621278209> (in direct messages) to complete registering.\n\n` +
      `${ia.member.roles.cache.find((r) => r.id == "634967372976881664") ? "You have 10% discount due to having the <@&634967372976881664> role.\n" : ""}` +
      `Any${ia.member.roles.cache.find((r) => r.id == "634967372976881664") ? " other " : " "} discounts will be informed to you by the subscription admins.`;
    await beyondChannel.send({ embeds: [ia.embed.setDescription(messageToAdmins)] });
    return await ia.editReply({ embeds: [ia.embed.setDescription(messageToUser)] });
  },
};
