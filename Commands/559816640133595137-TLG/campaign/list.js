const Discord = require("discord.js");
const { sep } = require("path");
const PFB = Discord.PermissionFlagsBits;
const name = __filename.split(sep)[__filename.split(sep).length - 1].replace(/\.[^/.]+$/, "");
const PAGELINES = 20;

Number.prototype.mod = function (n) {
    "use strict";
    return ((this % n) + n) % n;
};

module.exports = {
    authority: "everyone",
    botPermissions: [],
    data: new Discord.SlashCommandSubcommandBuilder()
        .setName(name)
        .setDescription("Show campaign information")
        .addStringOption((o) => o.setName("name").setDescription("Name filter").setMinLength(4).setMaxLength(45))
        .addStringOption((o) =>
            o
                .setName("status")
                .setDescription("Status filter")
                .addChoices(
                    { name: "Finding players", value: "Finding players" },
                    { name: "Waiting for start", value: "Waiting for start" },
                    { name: "Running", value: "Running" },
                    { name: "Paused", value: "Paused" }
                )
        )
        .addUserOption((o) => o.setName("dm").setDescription("Dungeon Master filter"))
        .addBooleanOption((o) => o.setName("is_os").setDescription("Oneshot / Long camp Filter"))
        .addBooleanOption((o) => o.setName("is_voice").setDescription("Voice-based / Text-based camp filter")),
    async execute(ia) {
        let reply = await ia.deferReply({ fetchReply: true });
        let name = ia.options.getString("name"),
            status = ia.options.getString("status"),
            dm = ia.options.getMember("dm"),
            isOS = ia.options.getBoolean("is_os"),
            isVoice = ia.options.getBoolean("is_voice"),
            campFilter = (c) => {
                let r = true;
                if (name !== null) r = r && c.name.toLowerCase().includes(name.toLowerCase());
                if (status !== null) r = r && c.state == status;
                if (dm !== null) r = r && c.dmm == dm.id;
                if (isOS !== null) r = r && c.isOS == isOS;
                if (isVoice !== null) r = r && c.isVoice == isVoice;
                return r;
            };

        let campList = (await ia.client.util.cacheCamps(ia.client)).filter(campFilter);
        let currentPage = 0,
            pages = Math.ceil(campList.length / PAGELINES);
        let campPages = [];

        if (!campList.length) return await ia.editReply({ embeds: [ia.embed.setDescription("No result found.")] });
        campList = campList.sort((a, b) => (a.isOS == b.isOS ? a.name.localeCompare(b.name, "vi", { sensitivity: "accent" }) : a.isOS ? -1 : 1));
        for (let i = 0; i <= Math.floor(campList.length / PAGELINES); i++) {
            let pageI = "";
            for (let j = PAGELINES * i; j < Math.min(campList.length, PAGELINES * (i + 1)); j++)
                pageI +=
                    `\`${String(j + 1).padStart(Math.floor(Math.log10(currentPage + 1)) + 2, "0")}\` - \`` +
                    `${campList[j].name}\` ${campList[j].isOS ? "(OS) " : ""}(${campList[j].isVoice ? "Voice" : "Text"})\n`;
            campPages.push(pageI);
        }
        let buttonFilter = (bia) => bia.isButton() && bia.user.id == ia.user.id && [`${ia.cid}=prev`, `${ia.cid}=next`].includes(bia.customId);
        const row = new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder().setCustomId(`${ia.cid}=prev`).setLabel("PREV").setStyle(Discord.ButtonStyle.Primary),
            new Discord.ButtonBuilder().setCustomId(`${ia.cid}=next`).setLabel("NEXT").setStyle(Discord.ButtonStyle.Primary),
            new Discord.ButtonBuilder().setCustomId(`${ia.cid}=done`).setLabel("DONE").setStyle(Discord.ButtonStyle.Danger)
        );
        if (campList.length > PAGELINES) {
            // TODO: remove page option; add two buttons PREV and NEXT and their listeners; pagination;
            // button ia collector on channel; timeout 2 minutes; delete buttons on end;
            // let currentPage = 0;
        }

        ia.embed
            .setTitle("Campaign list")
            .setDescription(campPages[currentPage])
            .setFooter({ text: `Page ${currentPage + 1} of ${pages}` });

        await ia.editReply({ embeds: [ia.embed], components: pages <= 1 ? [] : [row] });

        if (pages > 1) {
            let collector = reply.createMessageComponentCollector({ buttonFilter, time: 120000 });
            collector.on("collect", async (i) => {
                currentPage = i.customId.includes("prev")
                    ? (currentPage - 1).mod(pages)
                    : i.customId.includes("next")
                        ? (currentPage + 1).mod(pages)
                        : currentPage;
                if (i.customId.includes("done")) return await i.update({ embeds: [ia.embed], components: [] });
                ia.embed.setDescription(campPages[currentPage]).setFooter({ text: `Page ${currentPage + 1} of ${pages}` });
                await i.update({ embeds: [ia.embed], components: [row] });
            });
            collector.on("end", async (collected) => await ia.editReply({ embeds: [ia.embed], components: [] }));
        }
    },
};
