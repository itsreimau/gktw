"use strict";

const Baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");
const Functions = require("../../Helper/Functions.js");

class MessageCollector extends Collector {
    constructor(clientReq,
        options = {
            filter: function(args, collector) {
                throw new Error("Function not implemented.");
            },
            time: 0,
            max: 0,
            maxProcessed: 0,
            hears: []
        }) {
        super(options);
        this.clientReq = clientReq;
        this.jid = Baileys.jidNormalizedUser(this.clientReq.msg.key.remoteJid);
        this.hears = options.hears || [];
        this.received = 0;

        this.clientReq.self.ev.on(Events.MessagesUpsert, this.collect);
        this.once("end", () => {
            this.clientReq.self.ev.removeListener(Events.MessagesUpsert, this.collect);
        });

        return this;
    }

    async _collect(m) {
        const content = Functions.getContentFromMsg(m);
        const id = Baileys.jidNormalizedUser(m.key.remoteJid);
        if (!content || (!this.jid === id && !this.hears.includes(id))) return null;

        try {
            this.received++;
            return {
                ...m,
                content,
                message: Baileys.extractMessageContent(m.message),
                contentType: Functions.getContentType(m.message),
                id,
                sender: Baileys.jidNormalizedUser(m.key.participant || m.key.remoteJid)
            };
        } catch {
            return null;
        }
    }
}

module.exports = MessageCollector;