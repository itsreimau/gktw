"use strict";

const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");
const Functions = require("../../Helper/Functions.js");

class MessageCollector extends Collector {
    constructor(clientReq, opts = {}) {
        super(opts);
        this.clientReq = clientReq;
        this.jid = this.clientReq.msg.key.remoteJid;
        this.hears = opts.hears || [];

        this.handleCollect = this.collect.bind(this);
        this.clientReq.self.ev.on(Events.MessagesUpsert, this.handleCollect);
        this.once("end", () => {
            this.clientReq.self.ev.removeListener(Events.MessagesUpsert, this.handleCollect);
        });

        return this;
    }

    async _collect(m) {
        const content = Functions.getContentFromMsg(m);
        const id = Baileys.jidNormalizedUser(m.key.remoteJid);
        if (!content || (this.jid !== id && !this.hears.includes(id))) return null;

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