const EventEmitter = require("node:events");
const { jidNormalizedUser } = require("baileys");

class Cooldown extends EventEmitter {
    constructor(ctx, ms, mode = "multi") {
        super();
        this.ms = ms;
        this.mode = mode;
        this.cooldown = ctx._self.cooldown;
        this.timeout = 0;

        const name = mode === "single" ? `cooldown_${ctx._used.command}_${jidNormalizedUser(ctx._msg.key.remoteJid)}_${jidNormalizedUser(ctx._sender.jid)}` : `cooldown_${jidNormalizedUser(ctx._msg.key.remoteJid)}_${jidNormalizedUser(ctx._sender.jid)}`;
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