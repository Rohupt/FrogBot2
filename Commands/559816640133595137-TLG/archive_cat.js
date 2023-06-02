const Discord = require("discord.js");
const { sep } = require("path");
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");

module.exports = {
  authority: "moderators",
  botPermissions: [],
  data: new Discord.SlashCommandBuilder()
    .setName(name)
    .setDescription("Manage archive category")
    .addChannelOption((o) =>
      o.setName("new_category").setDescription("New category. Omit to see the current one.").addChannelTypes(Discord.ChannelType.GuildCategory)
    ),
  async execute(ia) {
    await ia.deferReply();
    let oldCat = (await ia.client.util.config()).archiveCat;
    let newCat = ia.options.getChannel("new_category", false, [Discord.ChannelType.GuildCategory]);

    if (!newCat) {
      return ia.editReply({
        embeds: [ia.embed.setDescription(`Current archive category is **<#${oldCat}>**.`)],
      });
    } else {
      if (newCat.children.size >= ia.client.data.constants.MAX_CHANNELS_PER_CATEGORY)
        return ia.editReply({
          embeds: [ia.embed.setDescription("Category already full. Please choose another category.")],
        });
      await ia.client.util.setConfig("archiveCat", newCat.id);
      return await ia.editReply({
        embeds: [ia.embed.setDescription(`Archive category changed to **<#${newCat.id}>**.`)],
      });
    }
  },
};
