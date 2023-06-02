// Require the necessary discord.js classes
require("module-alias/register");
require("dotenv").config();
const { sep } = require("path");
const Discord = require("discord.js");
const rest = new Discord.REST({ version: "10" }).setToken(process.env.TOKEN);

// Create a new client instance
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.DirectMessageReactions,
  ],
});

client.commands = new Discord.Collection();
client.commandData = new Discord.Collection();
client.data = {};
client.util = require("@util/utilities.js");

client.handleFilePath = (filePath, deleteCache = false) => {
  const dirs = filePath.split(sep).reverse();
  const fileType = dirs[0].replace(/^[^/.]+\./, "");
  dirs[0] = dirs[0].replace(/\.[^/.]+$/, "");
  dirs.getPath = (start, end) => dirs.slice(start, end).reverse().join("/");

  if (deleteCache) delete require.cache[require.resolve(`./${filePath}`)];
  // Mode: 0 - nothing; 1 - name; 2 - subcommand group; 3 - command; 4 - guild included
  dirs.getName = (type, mode = 4) => dirs.getPath(type < 0 ? 1 : 0, Math.min(mode, dirs.length - 1));
  dirs.getGroup = (guildIncluded = true) => (dirs[dirs.length - 1] != "Commands" ? null : dirs.getPath(dirs.length - 2, dirs.length - (guildIncluded ? 1 : 2)));
  dirs.getCommand = (guildIncluded = true) =>
    dirs[dirs.length - 1] != "Commands" ? null : dirs.getPath(dirs.length - 3, dirs.length - (guildIncluded ? 1 : 2));
  dirs.getGuild = () => (dirs[dirs.length - 1] != "Commands" ? null : dirs[dirs.length - 2].split("-").shift());
  return [dirs, fileType];
};

async function makeRequest(method, guildId = null, commandId = null, requestBody = null) {
  const route = `application${guildId == null ? "" : "Guild"}Command${commandId == null ? "s" : ""}`;
  let args = [process.env.BOT_ID];
  if (guildId != null) args.push(guildId);
  if (commandId != null) args.push(commandId);
  return await rest[method](Discord.Routes[route](...args), requestBody);
}

client.registerCommands = async () => {
  let commands = new Discord.Collection();
  function push(command, entry) {
    commands.ensure(entry, () => []).push(command.data.toJSON());
  }

  client.commandData.forEach((guild) => guild.forEach((command) => push(command, command.guild)));

  await Promise.all(
    Array.from(commands).map(async ([key, value]) => {
      await makeRequest("put", key == "global" ? null : key, null, { body: value }).then((list) => {
        for (const entry of list) {
          let command = client.commandData.get(key).get(entry.name);
          command.id = entry.id;
          command.subcommands?.forEach((subgroup, sgName) => {
            subgroup.id = `${command.id}=${sgName}`;
            subgroup.subcommands?.forEach((subcommand, scName) => (subcommand.id = `${command.id}=${sgName}=${scName}`));
          });
          client.commands.set(entry.id, command);
        }
      });
      client.log("API", `Registered ${key == "global" ? `global commands` : `commands for '${(await client.guilds.fetch(key)).name}' (${key})`}`);
    })
  );
};

client.cleanCommands = async (all = false) => {
  let initialGuildList = Array.from(client.guilds.cache.keys());
  initialGuildList.push("global");
  await Promise.all(
    initialGuildList
      .filter((k) => (all ? true : !Array.from(client.commandData.keys()).includes(k)))
      .map(async (key) => {
        await makeRequest("put", key == "global" ? null : key, null, { body: [] });
        client.log("API", `Deleted ${key == "global" ? `global commands` : `commands for '${(await client.guilds.fetch(key)).name}' (${key})`}`);
      })
  );
};

client.refreshCommands = async () => {
  let commands = new Discord.Collection();
  function push(command, entry) {
    commands.ensure(entry, () => []).push(command.data.toJSON());
  }

  client.commandData.forEach((guild) => guild.forEach((command) => push(command, command.guild)));
  Array.from(client.guilds.cache.keys()).forEach((guild) => commands.ensure(guild, () => []));
  commands.ensure("global", () => []);

  await Promise.all(
    Array.from(commands).map(async ([key, value]) => {
      await makeRequest("put", key == "global" ? null : key, null, { body: value }).then((list) => {
        if (list.length > 0)
          for (const entry of list) {
            let command = client.commandData.get(key).get(entry.name);
            command.id = entry.id;
            command.subcommands?.forEach((subgroup, sgName) => {
              subgroup.id = `${command.id}=${sgName}`;
              subgroup.subcommands?.forEach((subcommand, scName) => (subcommand.id = `${command.id}=${sgName}=${scName}`));
            });
            client.commands.set(entry.id, command);
          }
      });
      client.log("API", `Refreshed ${key == "global" ? `global commands` : `commands for '${(await client.guilds.fetch(key)).name}' (${key})`}`);
    })
  );
};

client.registerCommand = async (command) => {
  await makeRequest("post", (command.guild = "global" ? null : command.guild), null, { body: command.data.toJSON() }).then((result) => {
    command.id = result.id;
    command.subcommands?.forEach((subgroup, sgName) => {
      subgroup.id = `${command.id}=${sgName}`;
      subgroup.subcommands?.forEach((subcommand, scName) => (subcommand.id = `${command.id}=${sgName}=${scName}`));
    });
    client.commands.set(result.id, command);
  });
};

client.deleteCommand = async (command) => {
  await makeRequest("delete", command.guild == "global" ? null : command.guild, command.id, { body: command.data.toJSON() }).then((result) => {
    client.commands.delete(result.id);
    client.commandData.get(guild).delete(command.name);
  });
};

client.updateCommand = async (command) => {
  await makeRequest("patch", command.guild == "global" ? null : command.guild, command.id, { body: command.data.toJSON() });
};

client.reloadCommands = () => {
  client.commandData.forEach((guild) => guild.forEach((command) => client.commands.set(command.id, command)));
  client.log("API", "Commands reloaded");
};

client.log = (cat = "LOG", message = "", prependLines = 0, appendLines = 0) => {
  const breakLength = 60;
  const colours = new Map([
    ["WATCHER", "\x1b[35m"], // magenta
    ["API", "\x1b[35m"], // magenta
    ["COMMAND", "\x1b[36m"], // cyan
    ["STARTED", "\x1b[34m"], // blue
    ["READY", "\x1b[32m"], // green
    ["SUCCEEDED", "\x1b[32m"], // green
    ["WARNING", "\x1b[33m"], // yellow
    ["ERROR", "\x1b[31m"], // red
    ["FAILED", "\x1b[31m"], // red
    ["STOPPED", "\x1b[31m"], // red
    ["LOG", "\x1b[37m"], // white
  ]);
  cat = cat.toUpperCase();
  if (prependLines > 1) console.log("".padEnd(prependLines - 1, "\n").padEnd(breakLength + prependLines - 1, "="));
  else if (prependLines > 0) console.log("".padEnd(prependLines, "\n"));
  process.stdout.write(`[${colours.get(cat) ?? "\x1b[0m"}${cat.padStart(cat.length + Math.floor((11 - cat.length) / 2)).padEnd(11)}\x1b[0m] `);
  console.log(message);
  if (appendLines > 1) console.log("".padEnd(breakLength, "=").padEnd(breakLength + appendLines - 1, "\n"));
  else if (appendLines > 0) console.log("".padEnd(appendLines, "\n"));
};

client.error = (error) => {
  var stack = error.stack.toString().split("\n");
  client.log("ERROR", stack.shift());
  console.error(error);
};

module.exports = client;
