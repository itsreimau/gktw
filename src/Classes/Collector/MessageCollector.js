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
        if (!content.length || (!this.jid === m.key.remoteJid && !this.hears.includes(m.key.remoteJid)) || (!this.clientReq.self.selfReply && m.key.fromMe)) return null;

        try {
            this.received++;
            const senderJid = Functions.getSender(m, this.clientReq.self.core);
            return {
                ...m,
                content,
                message: Baileys.extractMessageContent(m.message),
                contentType: Functions.getContentType(m.message),
                id: m.key.remoteJid,
                senderJid,
                senderLid: await Functions.convertJid(senderJid, "lid", this.clientReq.self.jids, this.clientReq.self.core)
            };
        } catch {
            return null;
        }
    }
}

module.exports = MessageCollector;