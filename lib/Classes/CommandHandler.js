"use strict";

const {
    Consolefy
} = require("@mengkodingan/consolefy");
const {
    walk
} = require("../Helper/Functions.js");

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

        walk(this._path, (_walk) => {
            const cmdObj = require(_walk);

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