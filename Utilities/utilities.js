const Discord = require("discord.js");
const ServerModel = require("@data/Schema/server-schema.js");
const CampModel = require("@data/Schema/camp-schema.js");
const Config = require("@data/Schema/config-schema.js");

let user = (guild, string) => {
    if (!string) return null;
    const matches = string.match(/^<@!?(\d+)>$/);
    if (matches) return guild.members.cache.get(matches[1]) ?? guild.members.fetch(matches[1]);
    let user = () =>
        guild.members.cache.get(string) ??
        guild.members.resolve(string) ??
        Array.from(guild.members.cache.values()).find(
            (mem) =>
                (mem.nickname ? mem.nickname.toLowerCase().includes(string.toLowerCase()) : false) ||
                mem.user.tag.toLowerCase().includes(string.toLowerCase()) ||
                mem.user.username.includes(string.toLowerCase())
        );
    return user() ?? (guild.members.fetch(), user());
};

let channel = (guild, string) => {
    if (!string) return null;
    const matches = string.match(/^<#(\d+)>$/);
    if (matches) return guild.channels.cache.get(matches[1]) ?? guild.channels.fetch(matches[1]);
    let channel = () =>
        guild.channels.cache.get(string) ??
        guild.channels.resolve(string) ??
        Array.from(guild.channels.cache.values()).find((channel) => channel.name.toLowerCase().includes(string.toLowerCase()));
    return channel() ?? (guild.channels.fetch(), channel());
};

let role = (guild, string) => {
    if (!string) return null;
    const matches = string.match(/^<@&?(\d+)>$/);
    if (matches) return guild.roles.cache.get(matches[1]) ?? guild.roles.fetch(matches[1]);
    if (guild.roles.cache.get(string)) return guild.roles.cache.get(string);
    if (guild.roles.resolve(string)) return guild.roles.resolve(string);
    let role = () =>
        guild.roles.cache.get(string) ??
        guild.roles.resolve(string) ??
        Array.from(guild.roles.cache.values()).find((role) => role.name.toLowerCase().includes(string.toLowerCase()));
    return role() ?? (guild.roles.fetch(), role());
};

let findCamp = async (name, campList = null, fullName = false) => {
    campList ??= await CampModel.find({});

    let camp = null;
    camp =
        campList.find((c) => c.discussChannel == name || c.roleplayChannel == name) ??
        campList.find((c) => (fullName ? c.name.toLowerCase() == name.toLowerCase() : c.name.toLowerCase().includes(name.toLowerCase())));

    return camp;
};

let cacheCamps = async (client) => {
    client.data.tlg.camps = await CampModel.find({});
    client.log("API", "Camps cache reloaded");
    return client.data.tlg.camps;
};

let reloadFile = (filepath) => {
    delete require.cache[require.resolve(filepath)];
    return require(filepath);
};

let config = async () => {
    return await Config.findById("singleton");
};

let setConfig = async (key, value) => {
    await Config.updateOne({ _id: "singleton" }, { $set: ((o = {}), (o[key] = value), o) });
};

let newReturnEmbed = (ia, member) => {
    const isDM = ia.channel.type == "dm";
    const embed = new Discord.EmbedBuilder();
    embed
        .setAuthor({
            name: isDM ? ia.user.username : member ? member.nickname || member.user.username : ia.member.nickname || ia.user.username,
            iconURL: member ? member.user.avatarURL() : ia.author.avatarURL(),
        })
        .setColor(isDM ? "RANDOM" : member ? member.displayHexColor : ia.member.displayHexColor);
    return embed;
};

let getServerDB = async (id) => {
    return (await ServerModel.exists({ _id: id })) ? await ServerModel.findById(id) : await ServerModel.create({ _id: id, prefix: process.env.DEFAULT_PREFIX });
};

let commandPrefix = async (client, message) => {
    if (message.channel.type == "dm") return process.env.DEFAULT_PREFIX;
    if (!client.prefix[message.guild.id]) client.prefix[message.guild.id] = (await getServerDB(message.guild.id)).prefix;
    return client.prefix[message.guild.id];
};

let getCampNames = (name, isOS) => {
    let roleName = (isOS ? "OS " : "") + name;
    let chName = roleName.split(/ +/).join("-").toLowerCase();
    return [roleName, chName];
};

module.exports = {
    user,
    channel,
    role,
    findCamp,
    cacheCamps,
    reloadFile,
    config,
    setConfig,
    newReturnEmbed,
    getServerDB,
    commandPrefix,
    getCampNames,
};
