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
    .setDescription("Modify camp data. You cannot change the camp's base (voice/text), make a new camp instead.")
    .addStringOption((o) => o.setName("name").setDescription("The name of the camp").setMinLength(4).setMaxLength(45).setRequired(true))
    .addStringOption((o) => o.setName("new_name").setDescription("New name for the camp").setMinLength(4).setMaxLength(45))
    .addBooleanOption((o) => o.setName("is_os").setDescription("Set whether the campaign is a oneshot")),
  async execute(ia) {
    const name = ia.options.getString("name", true);
    let tlg = ia.client.util.reloadFile("@data/tlg.json");
    let camp = await ia.client.util.findCamp(name, ia.client.util.camps);
    ia.client.log("523", camp);
    if (!camp) return ia.reply({ embeds: [ia.embed.setDescription("Couldn't find the camp. Please check the name again.")], ephemeral: true });
    if (ia.user.id != camp.DM && !ia.member.roles.cache.some((r) => r.id == tlg.modRoleID) && !ia.member.permissions.has(PFB.Administrator)) {
      ia.embed.setDescription("You are not the Dungeon Master of this camp, nor a moderator.\nYou cannot use this command.");
      return ia.editReply({ embeds: [ia.embed] });
    }
    const modal = new Discord.ModalBuilder()
      .setCustomId(`${ia.cid}=moreInfo`)
      .setTitle(`${camp.name}`)
      .addComponents(
        new Discord.ActionRowBuilder().addComponents(
          new Discord.TextInputBuilder()
            .setCustomId("campDesc")
            .setLabel("Description")
            .setStyle(Discord.TextInputStyle.Paragraph)
            .setMaxLength(512)
            .setValue(camp.description)
        ),
        new Discord.ActionRowBuilder().addComponents(
          new Discord.TextInputBuilder()
            .setCustomId("campNotes")
            .setLabel("Notes")
            .setStyle(Discord.TextInputStyle.Paragraph)
            .setMaxLength(512)
            .setValue(camp.notes)
        )
      );

    await ia.showModal(modal);

    const msia = await ia.awaitModalSubmit({ time: 300000, filter: (i) => i.customId == `${ia.cid}=moreInfo` }).catch((error) => {
      ia.reply("Timeout. Creation failed.");
      throw new Error("Timeout");
    });

    msia.deferReply();

    const guild = ia.client.guilds.resolve(tlg.id);
    const newName = ia.options.getString("new_name");
    const isOS = ia.options.getBoolean("is_os");
    const description = msia.fields.getTextInputValue("campDesc");
    const notes = msia.fields.getTextInputValue("campNotes");
    await guild.roles.fetch();
    await guild.channels.fetch();
    ia.embed.setTitle(camp.name);

    function position(type, isOS = false, isVoice = false) {
      let offsets = type == "role" ? (isOS ? [0, 1] : [2, 1]) : [0, 0];
      let filter =
        type == "role"
          ? (r) => r.name.startsWith(isOS ? "OS " : "_")
          : (ch) =>
              (isOS ? ch.name.toLowerCase().startsWith("os") : true) &&
              (type == "disc" ? ch.parentId == tlg.discussCat : ch.parentId == tlg.roleplayCat && (ch.isVoiceBased() ? isVoice : !isVoice));
      let initialArray = Array.from(guild[type == "role" ? "roles" : "channels"].cache.values());
      let result = initialArray.filter(filter).sort((a, b) => b.position - a.position)[offsets[0]];
      return (result?.position ?? 0) + offsets[1];
    }

    let rpCh = ia.guild.channels.resolve(camp.roleplayChannel);
    let dcCh = ia.guild.channels.resolve(camp.discussChannel);
    let role = ia.guild.roles.resolve(camp.role);

    if (newName) {
      camp.name = newName;
      let [roleName, chName] = ia.client.util.getCampNames(newName, isOS ?? camp.isOS);
      Promise.all([rpCh.setName(camp.isVoice ? roleName : chName), dcCh.setName(chName), role.setName(roleName)]);
    }
    if (description != null) camp.description = description;
    if (notes != null) camp.notes = notes;
    if (isOS != null && isOS != camp.isOS) {
      camp.isOS = !camp.isOS;
      let rpChPos = position("rp", isOS, camp.isVoice) + 1;
      let dcChPos = position("disc", isOS, camp.isVoice) + 1;
      let rolePos = position("role", isOS, camp.isVoice);
      Promise.all([dcCh.setPosition(dcChPos), rpCh.setPosition(rpChPos), role.setPosition(rolePos)]);
      if (!newName) {
        let [roleName, chName] = ia.client.util.getCampNames(camp.name, isOS);
        Promise.all([rpCh.setName(camp.isVoice ? roleName : chName), dcCh.setName(chName), role.setName(roleName)]);
      }
    }
    // status

    await CampModel.updateOne({ _id: camp.id }, camp);
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
