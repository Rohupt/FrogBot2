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
        .setDescription("Delete a camp")
        .addStringOption((o) => o.setName("campaign").setDescription("FULL name of the camp to archive").setRequired(true)),
    async execute(ia) {
        await ia.deferReply();
        let campArg = ia.options.getString("campaign", true);
        let { noCampRoleID, advLeagueRoleCatID, dmRoleID } = ia.client.util.reloadFile("@data/tlg.json");
        let campList = await ia.client.util.cacheCamps(ia.client);
        let guild = ia.guild;

        let camp = await ia.client.util.findCamp(campArg, null, true);
        if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please provide the full name." });

        if (ia.channel.id == camp.roleplayChannel || ia.channel.id == camp.discussChannel)
            return ia.editReply({ embeds: [ia.embed.setDescription("Cannot use the command in this channel.")] });

        const dm = guild.members.resolve(camp.DM);
        try {
            Promise.all([
                guild.channels.resolve(camp.roleplayChannel).delete(),
                guild.channels.resolve(camp.discussChannel).delete(),
                guild.roles.resolve(camp.role).delete(),
            ]);
        } catch (error) {
            console.error(error);
            ia.embed.setDescription("...oops, seems like there is an error. Deletion incomplete. Please continue manually.");
            ia.editReply({ embeds: [ia.embed] });
            return ia.followUp(`\`\`\`\n${error}\n\`\`\``);
        }

        const campRoleMaxPos = guild.roles.resolve(noCampRoleID).position,
            campRoleMinPos = guild.roles.resolve(advLeagueRoleCatID).position;
        if (!campList.filter((c) => c.DM == camp.DM).length) {
            dm.roles.remove(dmRoleID);
            if (!dm.roles.cache.some((r) => r.position > campRoleMinPos && r.position < campRoleMaxPos))
                dm.roles.add(noCampRoleID);
        }
        for (p of camp.players) {
            let player = await guild.members.resolve(p.id);
            if (!player.roles.cache.some((r) => r.position > campRoleMinPos && r.position < campRoleMaxPos)) await player.roles.add(noCampRoleID);
        }

        campList.splice(campList.indexOf(camp), 1);
        await CampModel.deleteOne({ _id: camp.id });
        // let reportChannel = ia.channel || ia.author.dmChannel || await ia.author.createDM();

        await ia.editReply({ embeds: [ia.embed.setDescription(`Campaign deleted.`)] });
    },
};
