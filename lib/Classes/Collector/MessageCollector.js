"use strict";

const baileys = require("baileys");
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
        const [message] = m.messages;
        if (!message?.message) return;

        const content = Functions.getContentFrommessage(message);
        if ((this.jid === message.key.remoteJid || this.hears.includes(message.key.remoteJid)) && content?.length && this.clientReq.self.selfReply ? true : !message.key.fromMe) {
            this.received++;
            const message = baileys.extractMessageContent(message.message);
            const senderJid = await Functions.getSender(message, this.clientReq.self.core);
            return {
                content,
                ...message,
                contentType: baileys.getContentType(message),
                id: message.key.remoteJid,
                decodedId: message.key.remoteJid ? Functions.decodeJid(message.key.remoteJid) : null,
                senderJid: senderJid,
                decodedSenderJid: senderJid ? Functions.decodeJid(senderJid) : null
            };
        } else {
            return null;
        }
    }
}

module.exports = MessageCollector;