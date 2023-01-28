const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const CampModel = require("@data/Schema/camp-schema.js");

function validURL(str) {
    var pattern = new RegExp(
        "^(https?:\\/\\/)?" + // protocol
        "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
        "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
        "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
        "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
        "(\\#[-a-z\\d_]*)?$",
        "i"
    ); // fragment locator
    return !!pattern.test(str);
}

module.exports = {
    authority: "everyone",
    botPermissions: [PFB.ManageChannels, PFB.ManageRoles],
    data: new Discord.SlashCommandSubcommandBuilder()
        .setName(name)
        .setDescription("View player information")
        .addStringOption((o) =>
            o
                .setName("campaign")
                .setDescription("The campaign. If you're in a camp channel, you can type `-this` to indicate that camp.")
                .setMinLength(4)
                .setMaxLength(45)
                .setRequired(true)
        )
        .addUserOption((o) => o.setName("player").setDescription("The player whose info to be shown. Omit to show your own.")),
    async execute(ia) {
        let tlg = ia.client.util.reloadFile("@data/tlg.json");
        let campArg = await ia.options.getString("campaign");
        if (campArg == "-this") campArg = ia.channelId;

        await ia.deferReply();
        let camp = await ia.client.util.findCamp(campArg);
        if (!camp) return ia.editReply({ content: "Cannot find the campaign. Please recheck the name provided." });
        let player = ia.options.getMember("player") ?? ia.member;
        let campPlayer = camp.players.find((p) => p.id == player.id);
        if (!campPlayer) return await ia.editReply({ embeds: [ia.embed.setDescription("The member is not a player of this campaign.")] });
        ia.embed
            .setTitle(camp.name)
            .addFields([
                { name: "Player", value: `${player}`},
                { name: "Sheet link", value: campPlayer.sheet ? `[[Click here]](${campPlayer.sheet})` : "None", inline: true },
                { name: "Token link", value: campPlayer.token ? `[[Click here]](${campPlayer.token})` : "None", inline: true },
            ]);
        if (campPlayer.token) ia.embed.setImage(campPlayer.token);

        await ia.editReply({ embeds: [ia.embed] });
    },
};
