"use strict";

const EventEmitter = require("node:events");
const { decodeJid } = require("../Helper/Functions.js");

class Cooldown extends EventEmitter {
    constructor(ctx, ms) {
        super();
        this.ms = ms;
        this.cooldown = ctx._self.cooldown;
        this.timeout = 0;

        const name = `cooldown_${ctx._used.command}_${decodeJid(ctx._msg.key.remoteJid)}_${decodeJid(ctx._sender.lid)}`;
        const get = this.cooldown.get(name);

        if (get) {
            this.timeout = Number(get) - Date.now();
        } else {
            this.cooldown.set(name, Date.now() + ms);
            setTimeout(() => {
                this.cooldown.delete(name);
                this.emit("end");
            }, ms);
        }
    }

    get onCooldown() {
        return Boolean(this.timeout);
    }

    get timeleft() {
        return this.timeout;
    }
}

module.exports = Cooldown;