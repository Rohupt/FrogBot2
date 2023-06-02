const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");
const MessageToDM = "You will take control of your campaign from here.\n\n" + "**Have fun with your game! NAT 20!**";

module.exports = {
  authority: "moderators",
  botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
  data: new Discord.SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription("Create a campaign. You have 5 minutes to paste the description and notes of the camp.")
    .addStringOption((o) => o.setName("name").setDescription("The name of the camp").setMinLength(4).setMaxLength(45).setRequired(true))
    .addUserOption((o) => o.setName("dm").setDescription("The dungeon master. Omitting means yourself."))
    .addBooleanOption((o) => o.setName("is_os").setDescription("Set whether the campaign is a oneshot. Omitting means no."))
    .addBooleanOption((o) => o.setName("is_voice").setDescription("Set whether the campaign is a voice one. Omitting means no.")),
  async execute(ia) {
    const modal = new Discord.ModalBuilder()
      .setCustomId(`${ia.cid}=moreInfo`)
      .setTitle(ia.options.getString("name", true))
      .addComponents(
        new Discord.ActionRowBuilder().addComponents(
          new Discord.TextInputBuilder()
            .setCustomId("campDesc")
            .setLabel("Description")
            .setStyle(Discord.TextInputStyle.Paragraph)
            .setMaxLength(512)
            .setPlaceholder("Give some background or lore of the camp here.")
        ),
        new Discord.ActionRowBuilder().addComponents(
          new Discord.TextInputBuilder()
            .setCustomId("campNotes")
            .setLabel("Notes")
            .setStyle(Discord.TextInputStyle.Paragraph)
            .setMaxLength(512)
            .setPlaceholder("DM's note and rules of the camp.")
        )
      );

    await ia.showModal(modal);

    const msia = await ia.awaitModalSubmit({ time: 300000, filter: (i) => i.customId == `${ia.cid}=moreInfo` }).catch((error) => {
      ia.reply("Timeout. Creation failed.");
      throw new Error("Timeout");
    });

    msia.deferReply();

    let tlg = ia.client.util.reloadFile("@data/tlg.json");
    const guild = ia.client.guilds.resolve(tlg.id);
    const name = ia.options.getString("name", true);
    const master = ia.options.getUser("dm") ?? ia.user;
    const isOS = ia.options.getBoolean("is_os") ?? false;
    const isVoice = ia.options.getBoolean("is_voice") ?? false;
    const description = msia.fields.getTextInputValue("campDesc") ?? "";
    const notes = msia.fields.getTextInputValue("campNotes") ?? "";
    await guild.roles.fetch();
    await guild.channels.fetch();

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

    const newCamp = {
      name: name,
      isOS: isOS,
      isVoice: isVoice,
      DM: master.id,
      role: "",
      state: "Finding players",
      description: description,
      notes: notes,
      roleplayChannel: "",
      discussChannel: "",
      players: [],
    };

    let rpChPos = position("rp", isOS, isVoice) + 1;
    let dcChPos = position("disc", isOS, isVoice) + 1;
    let rolePos = position("role", isOS, isVoice);
    const [roleName, chName] = ia.client.util.getCampNames(newCamp.name, newCamp.isOS);

    var rpCh, dcCh, role;
    try {
      await guild.roles
        .create({
          name: roleName,
          position: rolePos,
          mentionable: true,
        })
        .then((r) => (role = r));
      await guild.channels
        .create({
          name: chName,
          parent: tlg.discussCat,
          position: dcChPos,
          permissionOverwrites: guild.channels.resolve(tlg.discussCat).permissionOverwrites.cache,
        })
        .then(async (ch) => {
          dcCh = ch;
          dcCh.setPosition(dcChPos);
          await dcCh.permissionOverwrites.create(role, tlg.permissions.textRole);
          await dcCh.permissionOverwrites.create(newCamp.DM, tlg.permissions.textDM);
        });
      await guild.channels
        .create({
          name: isVoice ? roleName : chName,
          parent: tlg.roleplayCat,
          position: rpChPos,
          permissionOverwrites: guild.channels.resolve(tlg.roleplayCat).permissionOverwrites.cache,
          type: isVoice ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
        })
        .then((ch) => {
          rpCh = ch;
          rpCh.setPosition(rpChPos);
          rpCh.setPosition(rpChPos);
          rpCh.permissionOverwrites.create(role, tlg.permissions[isVoice ? "voiceRole" : "textRole"]);
          rpCh.permissionOverwrites.create(newCamp.DM, tlg.permissions[isVoice ? "voiceDM" : "textDM"]);
        });
    } catch (error) {
      if (role && ia.client.util.role(ia.guild, role.id)) role.delete();
      ia.client.error(error);
      await ia.editReply("...oops, seems like there is an error. Creation incomplete.");
      return ia.followUp(`\`\`\`\n${error}\n\`\`\``);
    }

    newCamp.role = role.id;
    newCamp.roleplayChannel = rpCh.id;
    newCamp.discussChannel = dcCh.id;

    ia.embed
      .setTitle(name)
      .setDescription("Campaign creation completed. Here are the initial details of the camp:")
      .addFields(
        { name: "Type", value: `${isOS ? "OS" : "Full"} / ${isVoice ? "Voice" : "Text"}`, inline: true },
        { name: "State", value: newCamp.state, inline: true },
        { name: "DM", value: `${guild.members.resolve(master)}`, inline: true },
        { name: "Roleplay Channel", value: `<#${newCamp.roleplayChannel}>`, inline: true },
        { name: "Discuss Channel", value: `<#${newCamp.discussChannel}>`, inline: true },
        { name: "Role", value: `<@&${newCamp.role}>`, inline: true },
        { name: "Players", value: "No one yet" },
        { name: "Description", value: newCamp.description || "None" },
        { name: "Notes", value: newCamp.notes || "None" }
      );

    CampModel.create(newCamp);
    let dm = guild.members.resolve(newCamp.DM);
    await dm.roles.add([role]);
    if (!dm.roles.cache.has(tlg.dmRoleID)) await dm.roles.add([tlg.dmRoleID]);

    dmMsgEmbed = ia.client.util
      .newReturnEmbed(ia, await guild.members.resolve(newCamp.DM))
      .setTitle(`Welcome to campaign "${newCamp.name}"!`)
      .setDescription(MessageToDM);
    dcCh.send({ content: `<@!${newCamp.DM}>`, embeds: [dmMsgEmbed] });

    await msia.editReply({ embeds: [ia.embed] });
  },
};
