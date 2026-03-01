const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.jid = clientReq.msg.key.remoteJid;
        this.hears = opts.hears || [];

        this.handleCollect = (ctx) => this.collect(ctx);
        clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });
    }

    async _collect(ctx) {
        const jids = [ctx.msg.key.remoteJid, ctx.msg.key.remoteJidAlt];
        const jid = ctx.msg.key.fromMe ? ctx.me.id : jids.find(j => Baileys.isPnUser(j));
        const lid = ctx.msg.key.fromMe ? ctx.me.lid : jids.find(j => Baileys.isLidUser(j));
        const isMatch = (j) => {
            if (!j) return false;
            if (Baileys.isLidUser(this.jid) && Baileys.isLidUser(j)) return Baileys.areJidsSameUser(j, this.jid);
            if (Baileys.isPnUser(this.jid) && Baileys.isPnUser(j)) return Baileys.areJidsSameUser(j, this.jid);
            return Baileys.areJidsSameUser(j, this.jid);
        };
        if (isMatch(jid) || isMatch(lid)) return ctx;

        for (const hearJid of this.hears) {
            const hearMatch = (j) => {
                if (!j) return false;
                if (Baileys.isLidUser(hearJid) && Baileys.isLidUser(j)) return Baileys.areJidsSameUser(j, hearJid);
                if (Baileys.isPnUser(hearJid) && Baileys.isPnUser(j)) return Baileys.areJidsSameUser(j, hearJid);
                return Baileys.areJidsSameUser(j, hearJid);
            };
            if (hearMatch(jid) || hearMatch(lid)) return ctx;
        }

        return false;
    }
}

module.exports = MessageCollector;