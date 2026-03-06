const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.jids = [clientReq.msg.key.remoteJid, ...(opts.hears || [])];

        this.handleCollect = (ctx) => this.collect(ctx);
        clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });
    }

    async _collect(ctx) {
        const msgJids = [ctx.msg.key.remoteJid, ctx.msg.key.remoteJidAlt];
        for (const jid of this.jids) {
            for (const msgJid of msgJids) {
                if (Baileys.areJidsSameUser(jid, msgJid)) return ctx;
            }
        }
        return false;
    }
}

module.exports = MessageCollector;