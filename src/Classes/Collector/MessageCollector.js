const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.clientReq = clientReq;
        this.jid = Baileys.jidNormalizedUser(this.clientReq.msg.key.remoteJid);

        this.handleCollect = (ctx) => this.collect(ctx);
        this.clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            this.clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });

        return this;
    }

    async _collect(ctx) {
        if (!Baileys.areJidsSameUser(ctx.id, this.jid)) return false;
        return ctx;
    }
}

module.exports = MessageCollector;