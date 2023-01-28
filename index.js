// Require the necessary discord.js classes
require("module-alias/register");
require("dotenv").config();
const chokidar = require("chokidar");

const client = require("./client.js");

const watcherWatcher = chokidar.watch("./watcher.js", { cwd: "." });
let watcher = require("./watcher.js");
watcher.client = client;
watcher.isReady = false;
async function reloadWatcher(filePath) {
    if (watcher.isReady)
        await watcher.close().then(() => {
            client.log("STOPPED", `Watcher stopped`);
            // client.commands = new Discord.Collection();
            client.data = {};
            client.util = null;
            client.removeAllListeners();
            client.log("WATCHER", `Client reset`);
            // client.reloadCommands();
            watcher = null;
        });
    delete require.cache[require.resolve(`./${filePath}`)];
    watcher = require(`./${filePath}`);
    watcher.client = client;
    client.watcherResetTime = performance.now();
    client.log("STARTED", `Watcher started`, 10);
    watcher.execute();
}

watcherWatcher.on("add", async (filePath) => await reloadWatcher(filePath)).on("change", async (filePath) => await reloadWatcher(filePath));

process.on("unhandledRejection", async (err) => {
    client.error(err);
});
process.on("uncaughtException", async (err) => {
    client.error(err);
});
process.on("uncaughtExceptionMonitor", async (err) => {
    client.error(err);
});
