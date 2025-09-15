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
            const message = Baileys.extractMessageContent(m.message);
            const senderJid = await Functions.getSender(m, this.clientReq.self.core);
            return {
                content,
                message,
                ...m,
                contentType: Function.getContentType(message) !== "interactiveMessage" ? Functions.getContentType(message) : Functions.getContentType(message.interactiveMessage.header),
                id: m.key.remoteJid,
                decodedId: m.key.remoteJid ? Functions.decodeJid(m.key.remoteJid) : null,
                senderJid: senderJid,
                decodedSenderJid: senderJid ? Functions.decodeJid(senderJid) : null,
                senderLid: Baileys.isLidUser(senderJid) ? senderJid : (await this.clientReq.self.core.onWhatsApp(senderJid))[0].lid
            };
        } catch {
            return null;
        }
    }
}

module.exports = MessageCollector;