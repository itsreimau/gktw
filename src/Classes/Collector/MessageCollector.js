const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");
const Functions = require("../../Helper/Functions.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.clientReq = clientReq;
        this.jid = Baileys.jidNormalizedUser(this.clientReq.msg.key.remoteJid);
        this.hears = opts.hears ?? [];

        this.handleCollect = this.collect.bind(this);
        this.clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            this.clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });

        return this;
    }

    async _collect(m) {
        const content = Functions.getContentFromMsg(m);
        if (!content) return null;

        const id = Baileys.jidNormalizedUser(m.key.remoteJid);
        const idAlt = m.key.remoteJidAlt ? Baileys.jidNormalizedUser(m.key.remoteJidAlt) : null;

        const allIds = [id, idAlt].filter(Boolean);
        if (!allIds.includes(this.jid) && !this.hears.some(hear => allIds.includes(hear))) return null;

        return {
            ...m,
            content,
            message: Baileys.extractMessageContent(m.message),
            contentType: Functions.getContentType(m.message),
            id,
            sender: Baileys.jidNormalizedUser(m.key.participant || m.key.remoteJid)
        };
    }
}

module.exports = MessageCollector;