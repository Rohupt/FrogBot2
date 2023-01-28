const Discord = require("discord.js");
const { random } = require("mathjs");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");

module.exports = {
    authority: "developer",
    botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
    data: new Discord.SlashCommandSubcommandBuilder()
        .setName(name)
        .setDescription("Create a test camp")
        .addBooleanOption((o) => o.setName("is_os").setDescription("Set whether the campaign is a oneshot."))
        .addBooleanOption((o) => o.setName("is_voice").setDescription("Set whether the campaign is a voice one.")),
    async execute(ia) {
        await ia.deferReply();

        let tlg = ia.client.util.reloadFile("@data/tlg.json");
        const guild = ia.client.guilds.resolve(tlg.id);
        const isOS = ia.options.getBoolean("is_os") ?? false;
        const isVoice = ia.options.getBoolean("is_voice") ?? false;
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

        const master = await ia.guild.members.fetch("557993979015331843");

        const newCamp = {
            name: `ValderBot Test Camp ${Math.floor(random(10000, 100000))}`,
            isOS: isOS,
            isVoice: isVoice,
            DM: master.id,
            role: "",
            state: "Waiting for start",
            description: "Test camp",
            notes: "",
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
            if (dcCh && ia.client.util.channel(ia.guild, dcCh.id)) dcCh.delete();
            if (rpCh && ia.client.util.channel(ia.guild, rpCh.id)) rpCh.delete();
            ia.client.error(error);
            await ia.editReply("...oops, seems like there is an error. Creation incomplete.");
            return ia.followUp(`\`\`\`\n${error}\n\`\`\``);
        }

        newCamp.role = role.id;
        newCamp.roleplayChannel = rpCh.id;
        newCamp.discussChannel = dcCh.id;

        CampModel.create(newCamp);
        let dm = guild.members.resolve(newCamp.DM);
        await dm.roles.add([role]);
        if (!dm.roles.cache.has(tlg.dmRoleID)) await dm.roles.add([tlg.dmRoleID]);

        rpCh.send(`${role} Đây là kênh roleplay.`);
        dcCh.send(`${role} Đây là kênh thảo luận.`);

        await ia.editReply({ embeds: [ia.embed.setDescription(`Test camp created.\nRole: ${role}.\nRoleplay channel: ${rpCh}.\nDiscuss channel: ${dcCh}.`)] });
    },
};
