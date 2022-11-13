const Discord = require('discord.js');
const ServerModel = require('@data/Schema/server-schema.js');
const CampModel = require('@data/Schema/camp-schema.js');
const Config = require('@data/Schema/config-schema.js');

user = (guild, string) => {
    if (!string) return null;
    const matches = string.match(/^<@!?(\d+)>$/);
    if (matches) return guild.members.cache.get(matches[1]) ?? (guild.members.fetch(), guild.members.cache.get(matches[1]));
    let user = () => guild.members.cache.get(string) ?? guild.members.resolve(string) ??
        Array.from(guild.members.cache.values()).find(mem => (
            (mem.nickname ? mem.nickname.toLowerCase().includes(string.toLowerCase()) : false) ||
            mem.user.tag.toLowerCase().includes(string.toLowerCase()) ||
            mem.user.username.includes(string.toLowerCase()))
        );
    return user() ?? (guild.members.fetch(), user());
};

channel = (guild, string) => {
    if (!string) return null;
    const matches = string.match(/^<#(\d+)>$/);
    if (matches) return guild.channels.cache.get(matches[1]) ?? (guild.channels.fetch(), guild.channels.cache.get(matches[1]));
    let channel = () => guild.channels.cache.get(string) ?? guild.channels.resolve(string) ?? Array.from(guild.channels.cache.values())
        .find(channel => channel.name.toLowerCase().includes(string.toLowerCase()));
    return channel() ?? (guild.channels.fetch(), channel());
};

role = (guild, string) => {
    if (!string) return null;
    const matches = string.match(/^<@&?(\d+)>$/);
    if (matches) return guild.roles.cache.get(matches[1]) ?? (guild.roles.fetch(), guild.roles.cache.get(matches[1]));
    if (guild.roles.cache.get(string)) return guild.roles.cache.get(string);
    if (guild.roles.resolve(string)) return guild.roles.resolve(string);
    let role = () => guild.roles.cache.get(string) ?? guild.roles.resolve(string) ?? Array.from(guild.roles.cache.values())
        .find(role => role.name.toLowerCase().includes(string.toLowerCase()));
    return role() ?? (guild.roles.fetch(), role());
};

findCamp = async (message, args) => {
    var campList = await CampModel.find({});
        
    let camp = null, argCamp = null, campVar = false;
    camp = campList.find(c => (c.discussChannel == message.channel.id || c.roleplayChannel == message.channel.id));
    if (args.length > 0 && args[0] != '-' && args[0] != '+')
        argCamp = campList.find(c => c.name.toLowerCase().includes(args[0].toLowerCase()));
    if (argCamp || !camp) {
        camp = argCamp;
        campVar = true;
    }
    return {camp, campVar};
};

reloadFile = (filepath) => {
    delete require.cache[require.resolve(filepath)];
    return require(filepath);
};

config = async () => {
    return await Config.findById('singleton');
};

setConfig = async (key, value) => {
    await Config.updateOne({ _id: 'singleton'}, { $set: (o = {}, o[key] = value, o) });
};

newReturnEmbed = (message, member) => {
    const isDM = message.channel.type == 'dm';
    const embed = new Discord.MessageEmbed();
    embed.setAuthor({name: isDM
                ? message.author.username
                : member
                    ? (member.nickname || member.user.username)
                    : (message.member.nickname || message.author.username),
            iconURL: member ? member.user.avatarURL() : message.author.avatarURL()})
        .setColor(isDM ? 'RANDOM' : member ? member.displayHexColor : message.member.displayHexColor);
    return embed;
};

getServerDB = async (id) => {
    return await ServerModel.exists({ _id : id})
        ? await ServerModel.findById(id)
        : await ServerModel.create({ _id : id, prefix: process.env.DEFAULT_PREFIX});
};

commandPrefix = async (client, message) => {
    if (message.channel.type == 'dm') return process.env.DEFAULT_PREFIX;
    if (!client.prefix[message.guild.id])
        client.prefix[message.guild.id] = (await getServerDB(message.guild.id)).prefix;
    return client.prefix[message.guild.id];
};

getCampNames = (camp) => {
    let roleName = (camp.isOS ? "OS " : "") + camp.name;
    let chName = roleName.split(/ +/).join('-').toLowerCase();
    return {roleName, chName};
};

module.exports = {
    user, channel, role,
    findCamp,
    reloadFile,
    config,
    setConfig,
    newReturnEmbed,
    getServerDB,
    commandPrefix,
    getCampNames
}