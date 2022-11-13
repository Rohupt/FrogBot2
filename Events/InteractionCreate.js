function commandLog(ia, subcommand, subgroup) {
    return (
        `${ia.commandName} | ${subgroup ? subgroup + " | " : ""}${subcommand ?? ""}\n` +
        `Guild\t: ${ia.guild?.name ?? "None"}${ia.guild ? " (" + ia.guildId + ")" : ""}\n` +
        `Channel\t: ${ia.guild ? ia.channel.name : "Direct Message"} (${ia.channelId})\n` +
        `Caller\t: ${ia.user.tag} (${ia.user.id})\n` +
        `Time\t: ${ia.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
    );
}

module.exports = {
    once: false,
    async execute(ia) {
        if (!ia.isChatInputCommand()) return;
        let [subcommand, subgroup] = [ia.options.getSubcommand(false), ia.options.getSubcommandGroup(false)];
        const baseCommand = ia.client.commands.get(ia.commandName);
        const command =
            subcommand == null
                ? baseCommand
                : subgroup == null
                    ? baseCommand.subcommands?.get(subcommand)
                    : baseCommand.subcommands?.get(subgroup)?.subcommands?.get(subcommand);
        try {
            ia.client.log("COMMAND", commandLog(ia, subcommand, subgroup), 2, 2);
            command.execute(ia);
        } catch (error) {
            ia.client.error(error);
            await ia.reply({ content: "There was an error while executing this command!", ephemeral: true });
        }
    },
};
