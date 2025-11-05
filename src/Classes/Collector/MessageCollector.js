const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");
const Functions = require("../../Helper/Functions.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.clientReq = clientReq;
        this.jid = Baileys.jidNormalizedUser(this.clientReq.msg.key.remoteJid);

        this.handleCollect = this.collect.bind(this);
        this.clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            this.clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });

        return this;
    }

    async _collect(m) {
        const content = Functions.getContentFromMsg(m);
        if (!content) return false;

        const id = Baileys.jidNormalizedUser(m.key.remoteJid);
        if (!Baileys.areJidsSameUser(id, this.jid)) return false;

        const message = Baileys.extractMessageContent(m.message);
        return {
            ...m,
            content,
            message,
            messageType: Functions.getMessageType(message),
            id,
            sender: Baileys.jidNormalizedUser(m.key.participant || m.key.remoteJid)
        };
    }
}

module.exports = MessageCollector;