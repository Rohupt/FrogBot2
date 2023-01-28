const Discord = require("discord.js");
const PFB = Discord.PermissionFlagsBits;
const { pickRandom } = require("mathjs");

function commandLog(ia, subcommand, subgroup) {
    return (
        `${ia.commandName}${subgroup ? " | " + subgroup : ""}${subcommand ? " | " + subcommand : ""}\n` +
        `        Guild   : ${ia.guild?.name ?? "None"}${ia.guild ? " (" + ia.guildId + ")" : ""}\n` +
        `        Channel : ${ia.guild ? ia.channel.name : "Direct Message"} (${ia.channelId})\n` +
        `        Caller  : ${ia.user.tag} (${ia.user.id})\n` +
        `        Time    : ${ia.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} GMT+7`
    );
}

function checkUserPermission(ia, command) {
    switch (command.authority) {
        case "developer":
            return ia.user.id == process.env.OWNER_ID;
        case "owner":
            return ia.member == ia.guild.owner;
        case "administrators":
            return ia.member.permissions.has(PFB.Administrator);
        case "moderators":
            return ia.guild.id == ia.client.data.tlg.id
                ? ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.modRoleID) || ia.member.permissions.has(PFB.Administrator)
                : ia.member.permissions.has(PFB.Administrator);
        case "dungeonmasters":
            return ia.guild.id == ia.client.data.tlg.id
                ? ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.dmRoleID) ||
                ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.modRoleID) ||
                ia.member.permissions.has(PFB.Administrator)
                : ia.member.permissions.has(PFB.Administrator);
        default:
            return true;
    }
}

function checkBotPermission(ia, command) {
    if (ia.channel.type == "dm") return true;
    if (!ia.guild.members.me.permissions.has([...command.botPermissions, PFB.SendMessages])) {
        ia.reply({
            content:
                "Cannot execute the command because the bot lacks the following permissions:\n" +
                `\`${ia.guild.members.me.permissions.missing(Discord.PermissionsBitField.resolve(command.botPermissions))}\``,
            ephemeral: true,
        });
        return false;
    }
    return true;
}

module.exports = {
    once: false,
    async execute(ia) {
        if (ia.isChatInputCommand()) {
            let [subcommand, subgroup] = [ia.options.getSubcommand(false), ia.options.getSubcommandGroup(false)];
            const baseCommand = ia.client.commands.get(ia.commandId);
            const command =
                subcommand == null
                    ? baseCommand
                    : subgroup == null
                        ? baseCommand.subcommands?.get(subcommand)
                        : baseCommand.subcommands?.get(subgroup)?.subcommands?.get(subcommand);

            ia.cid = command.id;
            ia.embed = ia.client.util.newReturnEmbed(ia, ia.member);

            // Check developer mode
            if ((await ia.client.util.config()).developerMode && ia.user.id != process.env.OWNER_ID)
                return ia.reply({ content: pickRandom(ia.client.data.replies.developerMode) });

            // Check permissions
            if (!checkUserPermission(ia, command)) return ia.reply({ content: pickRandom(ia.client.data.replies[command.authority]) });
            if (!checkBotPermission(ia, command)) return;
            ia.client.log("COMMAND", commandLog(ia, subcommand, subgroup), 2, 0);

            try {
                if ((await command.execute(ia)) !== false) ia.client.log("SUCCEEDED", "Command executed successfully", 0, 2);
            } catch (error) {
                ia.client.error(error);
                ia.client.log("FAILED", "Command exited with an error", 0, 2);
                await ia[(await ia.fetchReply()) ? "editReply" : "reply"]({ content: "There was an error while executing this command!", ephemeral: true });
            }
            return;
        }
        // else if (ia.isModalSubmit()) {
        //     let cmdPath = ia.customId.split("=");
        //     const baseCommand = ia.client.commands.get(cmdPath[0]);
        //     const command =
        //         cmdPath.length == 2
        //             ? baseCommand
        //             : cmdPath.length == 3
        //                 ? baseCommand.subcommands?.get(cmdPath[1])
        //                 : baseCommand.subcommands?.get(cmdPath[1])?.subcommands?.get(cmdPath[2]);

        //     ia.cid = command.id;
        //     ia.embed = ia.client.util.newReturnEmbed(ia, ia.member);
        //     try {
        //         await command.modalExecute[cmdPath[cmdPath.length - 1]](ia);
        //         ia.client.log("SUCCEEDED", "Command executed successfully", 0, 2);
        //     } catch (error) {
        //         ia.client.error(error);
        //         ia.client.log("FAILED", "Command exited with an error", 0, 2);
        //         await ia.editReply({ content: "There was an error while executing this command!", ephemeral: true });
        //     }
        //     return;
        // }
    },
};
