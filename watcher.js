const Discord = require("discord.js");
const chokidar = require("chokidar");
const { sep } = require("path");
const _ = require("lodash");
const async = require("async");
const rest = new Discord.REST({ version: "10" }).setToken(process.env.TOKEN);
const watcher = chokidar.watch("./", { ignored: ["./Test", /(^|[\/\\])\../, "./node_modules", "./watcher.js"], cwd: "." });

function handleFilePath(filePath, deleteCache = false) {
    const dirs = filePath.split(sep).reverse();
    const fileType = dirs[0].replace(/^[^/.]+\./, "");
    dirs[0] = dirs[0].replace(/\.[^/.]+$/, "");
    if (deleteCache) delete require.cache[require.resolve(`./${filePath}`)];
    return [dirs, fileType];
}

function optionIndex(options, name) {
    return (options.findIndex((o) => o.name == name) + 1 || options.length + 1) - 1;
}

async function makeRequest(method, guildId = null, commandId = null, requestBody = null) {
    const route = `application${guildId == null ? "" : "Guild"}Command${commandId == null ? "s" : ""}`;
    let args = [process.env.BOT_ID];
    if (guildId != null) args.push(guildId);
    if (commandId != null) args.push(commandId);
    return await rest[method](Discord.Routes[route](...args), requestBody);
}

async function registerCommand(command, guild = null) {
    if (!guild) {
        // If it's a guild command
        if (!_.isEmpty(command.guilds))
            await Promise.all(
                command.guilds
                    .filter((g) => g != process.env.TEST_SERVER_ID)
                    .map(async (g) => await makeRequest("post", g, null, { body: command.data.toJSON() }).then((result) => command.ids.set(g, result.id)))
            );
        // It's a global command
        else await makeRequest("post", null, null, { body: command.data.toJSON() }).then((result) => command.ids.set("global", result.id));
        // Register it to the test server anyway
        await makeRequest("post", process.env.TEST_SERVER_ID, null, { body: command.data.toJSON() }).then((result) =>
            command.ids.set(process.env.TEST_SERVER_ID, result.id)
        );
    } else if (guild == "global") await makeRequest("post", null, null, { body: command.data.toJSON() }).then((result) => command.ids.set("global", result.id));
    else await makeRequest("post", guild, null, { body: command.data.toJSON() }).then((result) => command.ids.set(guild, result.id));
}

async function registerCommands(client) {
    let commands = new Discord.Collection();
    function push(command, entry) {
        commands.ensure(entry, () => []).push(command.data.toJSON());
    }

    function recordCommandIds(guild, commandList) {
        for (const command of commandList) client.commands.get(command.name).ids.set(guild, command.id);
    }

    client.commands.forEach((command) => {
        if (!_.isEmpty(command.guilds)) for (const guild of command.guilds.filter((g) => g != process.env.TEST_SERVER_ID)) push(command, guild);
        else push(command, "global");
        push(command, process.env.TEST_SERVER_ID);
    });
    await Promise.all(
        Array.from(commands).map(async ([key, value]) => {
            if (key == "global") {
                await makeRequest("put", null, null, { body: value }).then((result) => recordCommandIds("global", result));
                client.log("API", `Registered global commands`);
            } else {
                await makeRequest("put", key, null, { body: value }).then((result) => recordCommandIds(key, result));
                client.log("API", `Registered commands for guild ${key}`);
            }
        })
    );
}

async function deleteCommand(command, guild = null) {
    if (!guild) {
        // If it's a guild command
        if (!_.isEmpty(command.guilds))
            await Promise.all(
                command.guilds
                    .filter((g) => g != process.env.TEST_SERVER_ID)
                    .map(async (guild) => await makeRequest("delete", guild, command.ids.get(guild)).then((result) => command.ids.delete(guild)))
            );
        // It's a global command
        else if (command.ids.has("global")) await makeRequest("delete", null, command.ids.get("global")).then((result) => command.ids.delete("global"));
        // Register it to the test server anyway
        await makeRequest("delete", process.env.TEST_SERVER_ID, command.ids.get(process.env.TEST_SERVER_ID)).then((result) =>
            command.ids.delete(process.env.TEST_SERVER_ID)
        );
    } else if (guild == "global") await makeRequest("delete", null, null, { body: command.data.toJSON() }).then((result) => command.ids.delete("global"));
    else await makeRequest("delete", guild, null, { body: command.data.toJSON() }).then((result) => command.ids.delete(guild));
}

async function updateCommand(command, guild = null) {
    const oldGuilds = Array.from(command.ids.keys());
    if (!guild) {
        // Add the command to new servers
        for (const gld of command.guilds.filter((g) => !oldGuilds.includes(g))) await registerCommand(command, gld);
        // Delete the command from removed servers
        for (const gld of oldGuilds.filter((g) => !command.guilds.includes(g))) await deleteCommand(command, command.ids.get(gld));
        // Patch remaining servers
        for (const gld of command.guilds.filter((g) => oldGuilds.includes(g) && g != process.env.TEST_SERVER_ID)) await updateCommand(command, gld);
        // Patch test server
        await updateCommand(command, process.env.TEST_SERVER_ID);
        // Add global command
        if (_.isEmpty(command.guilds) && !_.isEmpty(oldGuilds)) await registerCommand(command, "global");
        // Delete global command
        if (_.isEmpty(oldGuilds) && !_.isEmpty(command.guilds)) await deleteCommand(command, command.ids.get("global"));
        // Patch global command
        if (_.isEmpty(command.guilds) && _.isEmpty(oldGuilds)) await updateCommand(command, "global");
    } else {
        // If the guild is new, register; else update
        if (!(guild in oldGuilds)) await registerCommand(command, guild);
        else await makeRequest("patch", guild == "global" ? null : guild, command.ids.get(guild), { body: command.data.toJSON() });
    }
}

function modifyCommand(record, command) {
    isSubcommand = (option) => option instanceof Discord.SlashCommandSubcommandBuilder || option instanceof Discord.SlashCommandSubcommandGroupBuilder;

    let hasChanged = false;
    let recordData = record;
    if (!isSubcommand(record)) {
        recordData = record.data;
        for (const field of Object.keys(command).filter((f) => f != "data" && f != "subcommands")) record[field] = command[field];
    }
    for (const field of Object.keys(command.data).filter((f) => f != "options"))
        if (recordData[field] !== command.data[field]) {
            recordData[field] = command.data[field];
            hasChanged ||= true;
        }
    if (command.data.options) {
        let recordOptions = recordData.options;
        for (option of command.data.options)
            if (
                !isSubcommand(option) &&
                !_.isEqual(
                    recordOptions.find((o) => o.name == option.name),
                    option
                )
            ) {
                recordOptions.splice(optionIndex(recordOptions, option.name), 1, option);
                hasChanged ||= true;
            }
    }
    return hasChanged;
}

function ensureSubcommand(command, name, description = "No desription") {
    let hasChanged = false;
    let cmd = (o) => o.name == name && o instanceof Discord.SlashCommandSubcommandBuilder;
    let cmdData = command instanceof Discord.SlashCommandSubcommandGroupBuilder ? command : command.data;
    if (!cmdData.options.find(cmd)) {
        cmdData.addSubcommand(new Discord.SlashCommandSubcommandBuilder().setName(name).setDescription(description));
        hasChanged ||= true;
    }
    return [cmdData.options.find(cmd), hasChanged];
}

function ensureSubcommandGroup(command, name, description = "No description") {
    let hasChanged = false;
    let group = (o) => o.name == name && o instanceof Discord.SlashCommandSubcommandGroupBuilder;
    if (!command.data.options.find(group)) {
        command.data.addSubcommandGroup(new Discord.SlashCommandSubcommandGroupBuilder().setName(name).setDescription(description));
        hasChanged ||= true;
    }
    return [command.data.options.find(group), hasChanged];
}

function newSlashCommand(name, description = "No description") {
    return {
        data: new Discord.SlashCommandBuilder().setName(name).setDescription(description),
        ids: new Discord.Collection(),
        guilds: [],
        subcommands: new Discord.Collection(),
    };
}

function checkCommand(dirs, command) {
    let type = null,
        dataType = null,
        lacks = 0,
        pass = true;
    switch (dirs.length) {
        case 2: // Normal command => 0
            type = 0;
            dataType = Discord.SlashCommandBuilder;
            break;
        case 3: // Base command => -1; or Direct subcommand => 1
            type = dirs[0] == dirs[1] ? -1 : 1;
            dataType = dirs[0] == dirs[1] ? Discord.SlashCommandBuilder : Discord.SlashCommandSubcommandBuilder;
            break;
        case 4: // Subcommand group => -2; or Subcommand in subcommand group => 2
            type = dirs[0] == dirs[1] ? -2 : 2;
            dataType = dirs[0] == dirs[1] ? Discord.SlashCommandSubcommandGroupBuilder : Discord.SlashCommandSubcommandBuilder;
            break;
        default:
            break;
    }
    if (!("execute" in command)) lacks |= 1 << 0;
    if (!("data" in command)) lacks |= 1 << 1;
    else {
        if (!(command.data instanceof dataType)) lacks |= 1 << 2;
        if (!command.data.name) lacks |= 1 << 3;
        if (!command.data.description) lacks |= 1 << 4;
    }
    if (type == null || (type >= 0 && (lacks & 1) != 0) || (lacks & ~1) != 0) pass = false;
    return [type, dataType.name, lacks, pass];
}

function checkCommandData(data, recursive = false) {
    check = (d) => d.name && d.description;
    if (!recursive || !data.options || data.options == []) return check(data);
    else {
        let result = check(data);
        data.options.forEach((option) => (result &&= checkCommandData(option, true)));
        return result;
    }
}

watcher.ready = async (client) => {
    watcher.isReady = true;
    await registerCommands(client);
    client.log("READY", `(${((performance.now() - client.watcherResetTime) / 1000).toFixed(6)} s) Watcher ready.`);
};

watcher.add = async (filePath, client) => {
    const [dirs, fileType] = handleFilePath(filePath, true);
    switch (dirs[dirs.length - 1]) {
        case "Commands":
            if (fileType != "js") break;
            const command = require(`./${filePath}`);
            const [type, dataType, lacks, pass] = checkCommand(dirs, command);
            if (type == 0 || type == -1) command.ids = new Discord.Collection();
            if (type < 0) command.subcommands = new Discord.Collection();
            let record, group, subdata;
            if (pass) {
                switch (type) {
                    // Normal command
                    case 0:
                        if (client.commands.has(dirs[0])) break;
                        client.commands.set(command.data.name, command);
                        if (watcher.isReady) client.log("WATCHER", `Added Command: ${dirs[0]}`);
                        break;
                    // Base command
                    case -1:
                        record = client.commands.ensure(dirs[1], () => newSlashCommand(dirs[1]));
                        modifyCommand(record, command);
                        if (watcher.isReady) client.log("WATCHER", `Added Base Command: ${dirs[0]}`);
                        break;
                    // Direct subcommand
                    case 1:
                        record = client.commands.ensure(dirs[1], () => newSlashCommand(dirs[1]));
                        record.data.addSubcommand(command.data);
                        record.subcommands.ensure(dirs[0], () => command); // Important: declare "execute" function for the subcommand
                        if (watcher.isReady) client.log("WATCHER", `Added Subcommand: ${dirs.slice(0, 2).reverse().join("/")}`);
                        break;
                    // Subcommand group
                    case -2:
                        record = client.commands.ensure(dirs[2], () => newSlashCommand(dirs[2]));
                        record.subcommands = record.subcommands ?? new Discord.Collection();
                        [group] = ensureSubcommandGroup(record, dirs[1]);
                        subdata = record.subcommands.ensure(dirs[0], () => command);
                        modifyCommand(group, command);
                        modifyCommand(subdata, command);
                        if (watcher.isReady) client.log("WATCHER", `Added Subcommand Group: ${dirs.slice(1, 3).reverse().join("/")}`);
                        break;
                    // Subcommand in subcommand group
                    case 2:
                        record = client.commands.ensure(dirs[2], () => newSlashCommand(dirs[2]));
                        // If in the future it's allowed to have nested groups, add a for loop to process the groups until reaching the subcommand
                        [group] = ensureSubcommandGroup(record, dirs[1]);
                        group.addSubcommand(command.data);
                        record.subcommands
                            .ensure(dirs[1], () => ({ data: { name: dirs[1] }, subcommands: new Discord.Collection() }))
                            .subcommands.ensure(dirs[0], () => command);
                        if (watcher.isReady) client.log("WATCHER", `Added Subcommand: ${dirs.slice(0, 3).reverse().join("/")}`);
                        break;
                    default:
                        break;
                }
                if (watcher.isReady) {
                    let cmd = client.commands.get(dirs[dirs.length - 2]);
                    if (!cmd || !cmd.data || !checkCommandData(cmd.data, true)) {
                        client.log("WARNING", `Command ${dirs.slice(0, -2).reverse().join("/")} lacking data`);
                    } else {
                        await registerCommand(cmd);
                        client.log("API", `Registered Command: ${dirs[dirs.length - 2]}`);
                    }
                }
            } else {
                let cmdText =
                    type == -2
                        ? `Subcommand group ${dirs.slice(0, 2).reverse().join("/")}`
                        : type <= 0
                            ? `Command ${dirs[0]}`
                            : `Subcommand ${dirs
                                .slice(0, type + 1)
                                .reverse()
                                .join("/")}`;
                let lackType = ["'execute' property", "'data' property", "option type", "name field", "'description' field"];
                let message = `${cmdText}:`;
                for (let i = 1; i <= 4; i++) {
                    if ((lacks & (1 << i)) != 0)
                        if (i == 2) message += `\n\t${lackType[i]} is wrong: expected ${dataType} but got ${command.data.constructor.name}`;
                        else message += `\n\t${lackType[i]} is missing`;
                }
                client.log("WARNING", message, 0, 1);
            }
            client.commands.delete(undefined);
            break;
        case "Events":
            if (fileType != "js") break;
            const event = require(`./${filePath}`);
            if (!client.listenerCount(Discord.Events[dirs[0]])) {
                client[event.once ? "once" : "on"](Discord.Events[dirs[0]], async (...args) => event.execute(...args));
                if (watcher.isReady) client.log("WATCHER", `Added Event: ${dirs[0]}`);
            }
            break;
        default:
            if (watcher.isReady) client.log("WATCHER", `Added File: ${filePath}`);
            break;
    }
};

watcher.change = async (filePath, client) => {
    const [dirs, fileType] = handleFilePath(filePath, true);
    switch (dirs[dirs.length - 1]) {
        case "Commands":
            if (fileType != "js") break;
            const command = require(`./${filePath}`);
            const [type, dataType, lacks, pass] = checkCommand(dirs, command);
            let record, obj, sub, group, hc;
            let hasChanged = false;
            if (pass) {
                switch (type) {
                    // Normal command
                    case 0:
                        record = client.commands.ensure(dirs[0], () => {
                            hasChanged ||= true;
                            return newSlashCommand(dirs[0]);
                        });
                        if (!_.isEqual(_.sortBy(record.guilds), _.sortBy(command.guilds))) hasChanged ||= true;
                        hasChanged ||= modifyCommand(record, command);
                        client.log("WATCHER", `Saved Command: ${dirs[0]}`);
                        break;
                    // Base command
                    case -1:
                        record = client.commands.ensure(dirs[1], () => {
                            hasChanged ||= true;
                            return newSlashCommand(dirs[1]);
                        });
                        if (!_.isEqual(_.sortBy(record.guilds), _.sortBy(command.guilds))) hasChanged ||= true;
                        hasChanged ||= modifyCommand(record, command);
                        client.log("WATCHER", `Saved Command: ${dirs.slice(0, 1).reverse().join("/")}`);
                        break;
                    // Direct subcommand
                    case 1:
                        // record = base command object
                        record = client.commands.ensure(dirs[1], () => {
                            hasChanged ||= true;
                            return newSlashCommand(dirs[1]);
                        });
                        record.subcommands = record.subcommands ?? new Discord.Collection();
                        // sub = record.data.subcommand data
                        [sub, hc] = ensureSubcommand(record, dirs[0]);
                        hasChanged ||= hc || modifyCommand(sub, command);
                        // obj = record.subcommands.subcommand object
                        obj = record.subcommands.ensure(dirs[0], () => command);
                        modifyCommand(obj, command);
                        client.log("WATCHER", `Saved Subcommand: ${dirs.slice(0, 1).reverse().join("/")}`);
                        break;
                    // Subcommand group
                    case -2:
                        // record = base command object
                        record = client.commands.ensure(dirs[2], () => {
                            hasChanged ||= true;
                            return newSlashCommand(dirs[2]);
                        });
                        record.subcommands = record.subcommands ?? new Discord.Collection();
                        // group = record.data.group data
                        [group, hc] = ensureSubcommandGroup(record, dirs[0]);
                        hasChanged ||= hc || modifyCommand(group, command);
                        // obj = record.subcommands.group object
                        obj = record.subcommands.ensure(dirs[0], () => {
                            hasChanged ||= true;
                            return command;
                        });
                        modifyCommand(obj, command);
                        client.log("WATCHER", `Saved Subcommand Group: ${dirs.slice(1, 3).reverse().join("/")}`);
                        break;
                    // Subcommand in subcommand group
                    case 2:
                        // record = base command object
                        record = client.commands.ensure(dirs[2], () => {
                            hasChanged ||= true;
                            return newSlashCommand(dirs[2]);
                        });
                        record.subcommands = record.subcommands ?? new Discord.Collection();
                        // group = record.data.group data, for-loop this if nested groups are allowed in the future
                        [group, hc] = ensureSubcommandGroup(record, dirs[1]);
                        hasChanged ||= hc;
                        // sub = group.subcommand data
                        [sub, hc] = ensureSubcommand(group, dirs[0]);
                        hasChanged ||= hc || modifyCommand(sub, command);
                        // gobj = record.subcommands.group.subcommands.subcommand object
                        obj = record.subcommands
                            .ensure(dirs[1], () => ({ data: { name: dirs[1] }, subcommands: new Discord.Collection() }))
                            .subcommands.ensure(dirs[0], () => command);
                        modifyCommand(obj, command);
                        client.log("WATCHER", `Saved Subcommand: ${dirs.slice(0, 3).reverse().join("/")}`);
                        break;
                    default:
                        break;
                }
                if (hasChanged && watcher.isReady) {
                    let cmd = client.commands.get(dirs[dirs.length - 2]);
                    if (!cmd || !cmd.data || !checkCommandData(cmd.data, true)) {
                        client.log("WARNING", `Command ${dirs.slice(0, -2).reverse().join("/")} lacking data`);
                    } else {
                        await updateCommand(client.commands.get(dirs[dirs.length - 2]));
                        client.log("API", `Updated Command: ${dirs[dirs.length - 2]}`);
                    }
                }
            } else {
                let cmdText =
                    type == -2
                        ? `Subcommand group ${dirs.slice(0, 2).reverse().join("/")}`
                        : type <= 0
                            ? `Command ${dirs[0]}`
                            : `Subcommand ${dirs
                                .slice(0, type + 1)
                                .reverse()
                                .join("/")}`;
                let lackType = ["'execute' property", "'data' property", "option type", "name field", "description field"];
                let message = `${cmdText}:`;
                for (let i = 1; i <= 4; i++) {
                    if ((lacks & (1 << i)) != 0)
                        if (i == 2) message += `\n\t${lackType[i]} is wrong: expected ${dataType} but got ${command.data.constructor.name}`;
                        else message += `\n\t${lackType[i]} is missing`;
                }
                client.log("WARNING", message, 0, 1);
            }
            break;
        case "Events":
            const event = require(`./${filePath}`);
            client.removeAllListeners(Discord.Events[dirs[0]]);
            client[event.once ? "once" : "on"](Discord.Events[dirs[0]], async (...args) => event.execute(...args));
            client.log("WATCHER", `Updated Event: ${dirs[0]}`);
            break;
        case "Utilities":
            if (dirs[0] == "utilities") {
                client.util = require("./Utilities/utilities.js");
                client.log("WATCHER", "Updated utilities");
            }
            break;
        case "Data":
            if (fileType == "json") {
                client.data[dirs[0]] = require(`./${filePath}`);
                client.log("WATCHER", `Updated ${name.join("/")}`);
            }
            break;
        default:
            client.log("WATCHER", `Updated File: ${filePath}`);
            break;
    }
};

watcher.unlink = async (filePath, client) => {
    const [dirs, fileType] = handleFilePath(filePath);
    switch (dirs[dirs.length - 1]) {
        case "Commands":
            if (fileType != "js") break;
            const command = require(`./${filePath}`);
            const [type, dataType, lacks, pass] = checkCommand(dirs, command);
            let record, obj, sub, group, hc;
            let hasChanged = false;
            switch (type) {
                // Normal command
                case 0:
                    record = client.commands.get(dirs[0]);
                    if (record) deleteCommand(record);
                    client.commands.delete(dirs[0]);
                    if (watcher.isReady) client.log("API", `Deleted Command: ${dirs[0]}`);
                    break;
                // Base command
                case -1:
                    record = client.commands.get(dirs[1]);
                    if (record) deleteCommand(record);
                    client.commands.delete(dirs[1]);
                    if (watcher.isReady) client.log("API", `Deleted Command: ${dirs.slice(0, 1).reverse().join("/")}`);
                    break;
                // Direct subcommand
                case 1:
                    record = client.commands.get(dirs[1]);
                    if (record) {
                        record.data.options.splice(optionIndex(record.data.options, dirs[0]), 1);
                        hasChanged = true;
                        record.subcommands.delete(dirs[0]);
                    }
                    if (watcher.isReady) client.log("API", `Deleted Subcommand: ${dirs.slice(0, 1).reverse().join("/")}`);
                    break;
                // Subcommand group
                case -2:
                    record = client.commands.get(dirs[2]);
                    if (record) {
                        record.data.options.splice(optionIndex(record.data.options, dirs[1]), 1);
                        hasChanged = true;
                        record.subcommands.delete(dirs[1]);
                    }
                    if (watcher.isReady) client.log("API", `Deleted Subcommand Group: ${dirs.slice(1, 3).reverse().join("/")}`);
                    break;
                // Subcommand in subcommand group
                case 2:
                    record = client.commands.get(dirs[1]);
                    if (record) {
                        record.data.options.get(dirs[1])?.options.splice(optionIndex(record.data.options.get(dirs[1]).options, dirs[0]), 1);
                        hasChanged = true;
                        record.subcommands.get(dirs[1])?.subcommands.delete(dirs[0]);
                    }
                    if (watcher.isReady) client.log("API", `Deleted Subcommand: ${dirs.slice(0, 3).reverse().join("/")}`);
                    break;
                default:
                    break;
            }
            if (hasChanged && watcher.isReady) {
                let cmd = client.commands.get(dirs[dirs.length - 2]);
                if (!cmd || !cmd.data || !checkCommandData(cmd.data, true)) {
                    client.log("WARNING", `Command ${dirs.slice(0, -2).reverse().join("/")} lacking data`);
                } else {
                    await updateCommand(client.commands.get(dirs[dirs.length - 2]));
                    client.log("API", `Updated Command: ${dirs[dirs.length - 2]}`);
                }
            }
            break;
        case "Events":
            client.removeAllListener(Discord.Events[dirs[0]]);
            client.log("WATCHER", `Deleted Event: ${dirs[0]}`);
            break;
        default:
            client.log("WATCHER", `Deleted File: ${filePath}`);
            break;
    }
};

watcher.addDir = (filePath, client) => {
    if (watcher.isReady) client.log("WATCHER", `Added Directory: ${filePath}`);
};

watcher.unlinkDir = (filePath, client) => {
    if (watcher.isReady) client.log("WATCHER", `Deleted Directory: ${filePath}`);
};

watcher.execute = (client) => {
    async function work(o, callback) {
        try {
            switch (o.event) {
                case "add":
                case "change":
                case "unlink":
                case "addDir":
                case "unlinkDir":
                    await watcher[o.event](o.filePath, client);
                    break;
                case "ready":
                    await watcher[o.event](client);
                    break;
                case "error":
                    client.error(o.error);
                    break;
                default:
                    break;
            }
        } catch (error) {
            client.error(error);
        }
        callback();
    }

    let q = async.queue(work);
    watcher.isReady = false;
    watcher
        .on("ready", () => q.push({ client, event: "ready" }, null))
        .on("add", (filePath) => q.push({ filePath, event: "add" }, null))
        .on("change", (filePath) => q.push({ filePath, event: "change" }, null))
        .on("unlink", (filePath) => q.push({ filePath, event: "unlink" }, null))
        .on("addDir", (filePath) => q.push({ filePath, event: "addDir" }, null))
        .on("unlinkDir", (filePath) => q.push({ filePath, event: "unlinkDir" }, null))
        .on("error", (error) => q.push({ error, event: "error" }, null));
};

module.exports = watcher;
