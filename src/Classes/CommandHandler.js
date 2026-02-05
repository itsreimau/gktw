const { Consolefy } = require("@mengkodingan/consolefy");
const { globSync } = require("glob");

class CommandHandler {
    constructor(bot, path) {
        this._bot = bot;
        this._path = path;
        this.consolefy = new Consolefy({
            tag: "command-handler"
        });
    }

    load(isShowLog = true) {
        if (isShowLog) this.consolefy.group("Command Handler Load");

        const files = globSync("**/*.js", {
            cwd: this._path,
            nodir: true,
            absolute: true
        }).sort((a, b) => a.localeCompare(b));

        for (const file of files) {
            try {
                const fileObj = require(file);
                if (!fileObj.type || fileObj.type === "command") {
                    this._bot.cmd.set(fileObj.name, fileObj);
                    if (isShowLog) this.consolefy.success(`Loaded Command: ${fileObj.name}`);
                } else if (fileObj.type === "hears") {
                    this._bot.hearsMap.set(fileObj.name, fileObj);
                    if (isShowLog) this.consolefy.success(`Loaded Hears: ${fileObj.name}`);
                }
            } catch (error) {
                if (isShowLog) this.consolefy.error(`Failed to load ${file}: ${error}`);
            }
        }

        if (isShowLog) this.consolefy.groupEnd();
    }
}

module.exports = CommandHandler;