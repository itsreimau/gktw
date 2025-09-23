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
        this.jid = this.clientReq.msg.key.remoteJid;
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
        if (!content || (!this.jid === m.key.remoteJid && !this.hears.includes(m.key.remoteJid))) return null;

        try {
            this.received++;
            return {
                ...m,
                content,
                message: Baileys.extractMessageContent(m.message),
                contentType: Functions.getContentType(m.message),
                id: m.key.remoteJid,
                sender: Functions.getSender(m, this.clientReq.self.core),
                senderPn: Functions.getSender(m, this.clientReq.self.core, "pn")
            };
        } catch {
            return null;
        }
    }
}

module.exports = MessageCollector;