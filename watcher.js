const Discord = require("discord.js");
const chokidar = require("chokidar");
const _ = require("lodash");
const async = require("async");
const watcher = chokidar.watch(".", { ignored: ["./Test", /(^|[\/\\])\../, "./node_modules", "./watcher.js"], cwd: "." });
var client;

function optionIndex(options, name) {
  return (options.findIndex((o) => o.name == name) + 1 || options.length + 1) - 1;
}

function modifyCommand(record, command) {
  let isSubcommand = (option) => option instanceof Discord.SlashCommandSubcommandBuilder || option instanceof Discord.SlashCommandSubcommandGroupBuilder;

  let hasChanged = false;
  let recordData = record;
  if (!isSubcommand(record)) {
    recordData = record.data;
    for (const field of Object.keys(command).filter((f) => f != "data" && f != "subcommands")) {
      record[field] = command[field];
    }
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
    id: null,
    guild: null,
    subcommands: new Discord.Collection(),
  };
}

function checkCommand(dirs, command) {
  let type = null,
    dataType = null,
    lacks = 0,
    pass = true;
  switch (dirs.length) {
    case 3: // Normal command => 0
      type = 0;
      dataType = Discord.SlashCommandBuilder;
      break;
    case 4: // Base command => -1; or Direct subcommand => 1
      type = dirs[0] == dirs[1] ? -1 : 1;
      dataType = dirs[0] == dirs[1] ? Discord.SlashCommandBuilder : Discord.SlashCommandSubcommandBuilder;
      break;
    case 5: // Subcommand group => -2; or Subcommand in subcommand group => 2
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

watcher.ready = async () => {
  watcher.isReady = true;
  client.log("READY", `(${((performance.now() - client.watcherResetTime) / 1000).toFixed(6)} s) Watcher ready`);
};

watcher.add = async (filePath) => {
  const [dirs, fileType] = client.handleFilePath(filePath, true);
  switch (dirs[dirs.length - 1]) {
    case "Commands":
      if (fileType != "js") break;
      const command = require(`./${filePath}`);
      const [type, dataType, lacks, pass] = checkCommand(dirs, command);
      command.guild = dirs.getGuild();
      if (type < 0) command.subcommands = new Discord.Collection();
      if (type == 0 || type == -1) command.id = null;
      let record, group, subdata;
      let guildCommands = client.commandData.ensure(dirs.getGuild(), () => new Discord.Collection());
      if (pass) {
        switch (type) {
          // Normal command
          case 0:
            if (guildCommands.has(dirs[0])) break;
            guildCommands.set(command.data.name, command);
            if (watcher.isReady) client.log("WATCHER", `Added Command: ${dirs.getName(type)}`);
            break;
          // Base command
          case -1:
            record = guildCommands.ensure(dirs[1], () => newSlashCommand(dirs[1]));
            modifyCommand(record, command);
            if (watcher.isReady) client.log("WATCHER", `Added Base Command: ${dirs.getName(type)}`);
            break;
          // Direct subcommand
          case 1:
            record = guildCommands.ensure(dirs[1], () => newSlashCommand(dirs[1]));
            record.data.addSubcommand(command.data);
            record.subcommands.ensure(dirs[0], () => command); // Important: declare "execute" function for the subcommand
            if (watcher.isReady) client.log("WATCHER", `Added Subcommand: ${dirs.getName(type)}`);
            break;
          // Subcommand group
          case -2:
            record = guildCommands.ensure(dirs[2], () => newSlashCommand(dirs[2]));
            record.subcommands = record.subcommands ?? new Discord.Collection();
            [group] = ensureSubcommandGroup(record, dirs[1]);
            subdata = record.subcommands.ensure(dirs[0], () => command);
            modifyCommand(group, command);
            modifyCommand(subdata, command);
            if (watcher.isReady) client.log("WATCHER", `@Added Subcommand Group: ${dirs.getName(type)}`);
            break;
          // Subcommand in subcommand group
          case 2:
            record = guildCommands.ensure(dirs[2], () => newSlashCommand(dirs[2]));
            // If in the future it's allowed to have nested groups, add a for loop to process the groups until reaching the subcommand
            [group] = ensureSubcommandGroup(record, dirs[1]);
            group.addSubcommand(command.data);
            record.subcommands
              .ensure(dirs[1], () => ({ data: { name: dirs[1] }, subcommands: new Discord.Collection() }))
              .subcommands.ensure(dirs[0], () => command);
            if (watcher.isReady) client.log("WATCHER", `Added Subcommand: ${dirs.getName(type)}`);
            break;
          default:
            break;
        }
        if (watcher.isReady) {
          let cmd = client.commandData.get(dirs.getGuild()).get(dirs[dirs.length - 3]);
          if (!cmd || !cmd.data || !checkCommandData(cmd.data, true)) {
            client.log("WARNING", `Command ${dirs.getName(type)} lacking data`);
          } else {
            await client.registerCommand(cmd);
            client.log("API", `Registered Command: ${dirs.getName(type)}`);
          }
        }
      } else {
        let cmdText = type == -2 ? `Subcommand group ${dirs.getName(type)}` : type <= 0 ? `Command ${dirs.getName(type)}` : `Subcommand ${dirs.getName(type)}`;
        let lackType = ["'execute' property", "'data' property", "option type", "name field", "'description' field"];
        let message = `${cmdText}:`;
        for (let i = 1; i <= 4; i++) {
          if ((lacks & (1 << i)) != 0)
            if (i == 2) message += `\n\t${lackType[i]} is wrong: expected ${dataType} but got ${command.data.constructor.name}`;
            else message += `\n\t${lackType[i]} is missing`;
        }
        client.log("WARNING", message, 0, 0);
      }
      client.commandData.delete(undefined);
      break;
    case "Events":
      if (fileType != "js") break;
      const event = require(`./${filePath}`);
      if (!client.listenerCount(Discord.Events[dirs[0]])) {
        client[event.once ? "once" : "on"](Discord.Events[dirs[0]], async (...args) => event.execute(...args));
        if (watcher.isReady) client.log("WATCHER", `Added Event: ${dirs[0]}`);
      }
      break;
    case "Utilities":
      if (dirs[0] == "utilities") {
        client.util = require("./Utilities/utilities.js");
        if (watcher.isReady) client.log("WATCHER", "Added utilities");
      }
      break;
    case "Data":
      if (fileType == "json") {
        client.data[dirs[0]] = require(`./${filePath}`);
        if (watcher.isReady) client.log("WATCHER", `Added ${dirs.getName(2)}`);
      }
      break;
    default:
      if (watcher.isReady) client.log("WATCHER", `Added File: ${filePath}`);
      break;
  }
};

watcher.change = async (filePath) => {
  const [dirs, fileType] = client.handleFilePath(filePath, true);
  switch (dirs[dirs.length - 1]) {
    case "Commands":
      if (fileType != "js") break;
      const command = require(`./${filePath}`);
      const [type, dataType, lacks, pass] = checkCommand(dirs, command);
      let record, obj, sub, group, hc;
      let guildCommands = client.commandData.ensure(dirs.getGuild(), () => new Discord.Collection());
      let hasChanged = false;
      if (pass) {
        switch (type) {
          // Normal command
          case 0:
            record = guildCommands.ensure(dirs[0], () => {
              hasChanged ||= true;
              return newSlashCommand(dirs[0]);
            });
            hasChanged ||= modifyCommand(record, command);
            client.log("WATCHER", `Saved Command: ${dirs.getName(type)}`);
            break;
          // Base command
          case -1:
            record = guildCommands.ensure(dirs[1], () => {
              hasChanged ||= true;
              return newSlashCommand(dirs[1]);
            });
            hasChanged ||= modifyCommand(record, command);
            client.log("WATCHER", `Saved Command: ${dirs.getName(type)}`);
            break;
          // Direct subcommand
          case 1:
            // record = base command object
            record = guildCommands.ensure(dirs[1], () => {
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
            client.log("WATCHER", `Saved Subcommand: ${dirs.getName(type)}`);
            break;
          // Subcommand group
          case -2:
            // record = base command object
            record = guildCommands.ensure(dirs[2], () => {
              hasChanged ||= true;
              return newSlashCommand(dirs[2]);
            });
            record.subcommands = record.subcommands ?? new Discord.Collection();
            // group = record.data.group data
            [group, hc] = ensureSubcommandGroup(record, dirs[0]);
            hasChanged ||= hc || modifyCommand(group, command);
            // obj = record.subcommands.group object
            obj = guildCommands.ensure(dirs[0], () => {
              hasChanged ||= true;
              return command;
            });
            modifyCommand(obj, command);
            client.log("WATCHER", `Saved Subcommand Group: ${dirs.getName(type)}`);
            break;
          // Subcommand in subcommand group
          case 2:
            // record = base command object
            record = guildCommands.ensure(dirs[2], () => {
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
            // obj = record.subcommands.group.subcommands.subcommand object
            obj = record.subcommands
              .ensure(dirs[1], () => ({ data: { name: dirs[1] }, subcommands: new Discord.Collection() }))
              .subcommands.ensure(dirs[0], () => command);
            modifyCommand(obj, command);
            client.log("WATCHER", `Saved Subcommand: ${dirs.getName(type)}`);
            break;
          default:
            break;
        }
        if (hasChanged && watcher.isReady) {
          let cmd = client.commandData.get(dirs.getGuild()).get(dirs[dirs.length - 3]);
          if (!cmd || !cmd.data || !checkCommandData(cmd.data, true)) {
            client.log("WARNING", `Command ${dirs.getCommand()} lacking data`);
          } else {
            await client.updateCommand(cmd);
            client.log("API", `Updated Command: ${dirs.getCommand()}`);
          }
        }
      } else {
        let cmdText = (type == -2 ? "Subcommand group" : type <= 0 ? "Command" : "Subcommand") + ` ${dirs.getName(type)}`;
        let lackType = ["'execute' property", "'data' property", "option type", "name field", "description field"];
        let message = `${cmdText}:`;
        for (let i = 1; i <= 4; i++) {
          if ((lacks & (1 << i)) != 0)
            if (i == 2) message += `\n\t${lackType[i]} is wrong: expected ${dataType} but got ${command.data.constructor.name}`;
            else message += `\n\t${lackType[i]} is missing`;
        }
        client.log("WARNING", message, 0, 0);
      }
      break;
    case "Events":
      const event = require(`./${filePath}`);
      client.removeAllListeners(Discord.Events[dirs[0]]);
      client[event.once ? "once" : "on"](Discord.Events[dirs[0]], async (...args) => event.execute(...args));
      client.log("WATCHER", `Updated Event: ${dirs.getName(1)}`);
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
        client.log("WATCHER", `Updated ${dirs.getName(1)}`);
      }
      break;
    default:
      client.log("WATCHER", `Updated File: ${filePath}`);
      break;
  }
};

watcher.unlink = async (filePath) => {
  const [dirs, fileType] = client.handleFilePath(filePath);
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
          record = client.commandData.get(dirs[0]);
          if (record) client.deleteCommand(record);
          client.commandData.delete(dirs[0]);
          if (watcher.isReady) client.log("API", `Deleted Command: ${dirs.getName(type)}`);
          break;
        // Base command
        case -1:
          record = client.commandData.get(dirs[1]);
          if (record) client.deleteCommand(record);
          client.commandData.delete(dirs[1]);
          if (watcher.isReady) client.log("API", `Deleted Command: ${dirs.getName(type)}`);
          break;
        // Direct subcommand
        case 1:
          record = client.commandData.get(dirs[1]);
          if (record) {
            record.data.options.splice(optionIndex(record.data.options, dirs[0]), 1);
            hasChanged = true;
            record.subcommands.delete(dirs[0]);
          }
          if (watcher.isReady) client.log("API", `Deleted Subcommand: ${dirs.getName(type)}`);
          break;
        // Subcommand group
        case -2:
          record = client.commandData.get(dirs[2]);
          if (record) {
            record.data.options.splice(optionIndex(record.data.options, dirs[1]), 1);
            hasChanged = true;
            record.subcommands.delete(dirs[1]);
          }
          if (watcher.isReady) client.log("API", `Deleted Subcommand Group: ${dirs.getName(type)}`);
          break;
        // Subcommand in subcommand group
        case 2:
          record = client.commandData.get(dirs[1]);
          if (record) {
            record.data.options.get(dirs[1])?.options.splice(optionIndex(record.data.options.get(dirs[1]).options, dirs[0]), 1);
            hasChanged = true;
            record.subcommands.get(dirs[1])?.subcommands.delete(dirs[0]);
          }
          if (watcher.isReady) client.log("API", `Deleted Subcommand: ${dirs.getName(type)}`);
          break;
        default:
          break;
      }
      if (hasChanged && watcher.isReady) {
        let cmd = client.commandData.get(dirs.getGuild()).get(dirs[dirs.length - 3]);
        if (!cmd || !cmd.data || !checkCommandData(cmd.data, true)) {
          client.log("WARNING", `Command ${dirs.getName(type)} lacking data`);
        } else {
          await client.updateCommand(cmd);
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

watcher.addDir = (filePath) => {
  if (watcher.isReady) client.log("WATCHER", `Added Directory: ${filePath}`);
};

watcher.unlinkDir = (filePath) => {
  if (watcher.isReady) client.log("WATCHER", `Deleted Directory: ${filePath}`);
};

watcher.execute = () => {
  client = watcher.client;
  async function work(o, callback) {
    try {
      switch (o.event) {
        case "add":
        case "change":
        case "unlink":
        case "addDir":
        case "unlinkDir":
          await watcher[o.event](o.filePath);
          break;
        case "ready":
          await watcher[o.event]();
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

  if (!client.loggedIn) client.login(process.env.TOKEN);
  client.loggedIn = true;
};

module.exports = watcher;
