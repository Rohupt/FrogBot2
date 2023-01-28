const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");

module.exports = {
    authority: "moderators",
    botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
    data: new Discord.SlashCommandSubcommandBuilder()
        .setName(name)
        .setDescription("Modify the Dungeon Master of the campaign.")
        .addStringOption((o) =>
            o
                .setName("campaign")
                .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
                .setMinLength(4)
                .setMaxLength(45)
                .setRequired(true)
        )
        .addUserOption((o) => o.setName("new_dm").setDescription("The new Dungeon Master of the campaign").setRequired(true)),
    async execute(ia) {
        let tlg = ia.client.util.reloadFile("@data/tlg.json");
        let campArg = ia.options.getString("campaign");
        let newDM = ia.options.getMember("new_dm");
        var campList = await ia.client.util.cacheCamps(ia.client);
        if (campArg == "-this") campArg = ia.channelId;

        await ia.deferReply();
        let camp = await ia.client.util.findCamp(campArg, campList);
        if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });
        const oldDM = await ia.guild.members.fetch(camp.DM);
        if (oldDM === newDM)
            return await ia.editReply({ embeds: [ia.embed.setDescription("The old DM and the new one are the same person, hence no change made.")] });

        const rpCh = await ia.guild.channels.fetch(camp.roleplayChannel),
            dcCh = await ia.guild.channels.fetch(camp.discussChannel),
            campRoleMaxPos = (await ia.guild.roles.fetch(tlg.noCampRoleID)).position,
            campRoleMinPos = (await ia.guild.roles.fetch(tlg.advLeagueRoleCatID)).position;
        camp.DM = newDM.id;
        let permissions = tlg.permissions[camp.isVoice ? "voiceDM" : "textDM"];

        if (!camp.players.some((p) => p == oldDM.id)) await oldDM.roles.remove(camp.role);
        if (!oldDM.roles.cache.some((r) => r.position > campRoleMinPos && r.position < campRoleMaxPos)) await oldDM.roles.add(tlg.noCampRoleID);

        await Promise.all([
            rpCh.permissionOverwrites.delete(oldDM.id),
            dcCh.permissionOverwrites.delete(oldDM.id),
            !campList.filter((c) => c.DM == oldDM.id).length && oldDM.roles.cache.has(tlg.dmRoleID) ? oldDM.roles.remove(tlg.dmRoleID) : Promise.resolve(),
            newDM.roles.cache.has(tlg.noCampRoleID) ? newDM.roles.remove(tlg.noCampRoleID) : Promise.resolve(),
            !newDM.roles.cache.has(camp.role) ? newDM.roles.add([camp.role]) : Promise.resolve(),
            !newDM.roles.cache.has(tlg.dmRoleID) ? newDM.roles.add([tlg.dmRoleID]) : Promise.resolve(),
            rpCh.permissionOverwrites.create(newDM, permissions),
            dcCh.permissionOverwrites.create(newDM, permissions),
        ]);

        try {
            await CampModel.updateOne({ _id: camp.id }, { $set: { DM: camp.DM } });
        } catch (e) {
            await ia.editReply({ embeds: [ia.embed.setDescription("Update failed. Please try again later.")] });
            throw e;
        }
        ia.embed
            .setTitle(camp.name)
            .setDescription("Dungeon Master changed sucessfully:")
            .addFields([
                { name: "Old DM", value: oldDM.toString(), inline: true },
                { name: "New DM", value: newDM.toString(), inline: true },
            ]);

        await ia.editReply({ embeds: [ia.embed] });
    },
};
