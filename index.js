// Require the necessary discord.js classes
require("module-alias/register");
require("dotenv").config();
const Discord = require("discord.js");
const chokidar = require("chokidar");

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
client.subcommands = new Discord.Collection();
client.data = {};
client.util = require('@util/utilities.js')

client.log = (cat = "LOG", message = "", prependLines = 0, appendLines = 0) => {
    const breakLength = 60;
    const colours = new Map([
        ["WATCHER", "\x1b[35m"], // magenta
        ["API", "\x1b[35m"], // magenta
        ["COMMAND", "\x1b[36m"], // cyan
        ["STARTED", "\x1b[34m"], // blue
        ["READY", "\x1b[32m"], // green
        ["SUCCESSFUL", "\x1b[32m"], // green
        ["WARNING", "\x1b[33m"], // yellow
        ["ERROR", "\x1b[31m"], // red
        ["FAILED", "\x1b[31m"], // red
        ["STOPPED", "\x1b[31m"], // red
        ["LOG", "\x1b[37m"], // white
    ]);
    cat = cat.toUpperCase();
    if (prependLines > 1) {
        console.log("".padEnd(prependLines - 1, "\n"));
        console.log("".padEnd(breakLength, "="));
    } else if (prependLines > 0) console.log("".padEnd(prependLines, "\n"));
    process.stdout.write(`[${colours.get(cat) ?? "\x1b[0m"}${cat.padStart(cat.length + Math.floor((11 - cat.length) / 2)).padEnd(11)}\x1b[0m] `);
    console.log(message);
    if (appendLines > 1) console.log("".padEnd(breakLength, "="), "".padEnd(appendLines - 1, "\n"));
    else if (appendLines > 0) console.log("".padEnd(appendLines, "\n"));
};

client.error = (error) => {
    var stack = error.stack.toString().split("\n");
    client.log("ERROR", stack.shift());
    console.error(error);
};

client.login(process.env.TOKEN);

const watcherWatcher = chokidar.watch("./watcher.js", { cwd: "." });
var watcher = chokidar.watch("./", { ignored: ["./Test", /(^|[\/\\])\../, "./node_modules", "./watcher.js"], cwd: "." });
watcher.isReady = false;
async function reloadWatcher(filePath) {
    if (watcher.isReady)
        await watcher.close().then(() => {
            client.log("STOPPED", `Watcher stopped`);
            client.commands = new Discord.Collection();
            client.data = {};
            client.util = null;
            client.removeAllListeners();
            client.log("WATCHER", `Client reset`);
            watcher = null;
        });
    delete require.cache[require.resolve(`./${filePath}`)];
    watcher = require(`./${filePath}`);
    client.watcherResetTime = performance.now();
    client.log("STARTED", `Watcher started`, 10);
    watcher.execute(client);
}

watcherWatcher.on("add", async (filePath) => await reloadWatcher(filePath)).on("change", async (filePath) => await reloadWatcher(filePath));
