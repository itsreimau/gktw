const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.jid = clientReq.msg.key.remoteJid;

        this.handleCollect = (ctx) => this.collect(ctx);
        clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });
    }

    async _collect(ctx) {
        return Baileys.areJidsSameUser(ctx.id, this.jid) ? ctx : false;
    }
}

module.exports = MessageCollector;