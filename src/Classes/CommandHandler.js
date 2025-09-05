"use strict";

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
        });

        files.sort((a, b) => a.localeCompare(b));

        files.forEach(file => {
            const cmdObj = require(file);

            if (!cmdObj.type || cmdObj.type === "command") {
                this._bot.cmd.set(cmdObj.name, cmdObj);
                if (isShowLog) this.consolefy.success(`Loaded Command - ${cmdObj.name}`);
            } else if (cmdObj.type === "hears") {
                this._bot.hearsMap.set(cmdObj.name, cmdObj);
                if (isShowLog) this.consolefy.success(`Loaded Hears - ${cmdObj.name}`);
            }
        });

        if (isShowLog) this.consolefy.groupEnd();
    }
}

module.exports = CommandHandler;