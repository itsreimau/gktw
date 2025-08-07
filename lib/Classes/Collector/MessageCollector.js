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

    async _collect(msg) {
        const content = Functions.getContentFromMsg(msg);
        if ((this.clientReq.self.selfReply ? msg.key.fromMe : !msg.key.fromMe) && (this.jid === msg.key.remoteJid || this.hears.includes(msg.key.remoteJid)) && content?.length) {
            this.received++;
            const message = baileys.extractMessageContent(msg.message);
            const senderJid = await Functions.getSender(msg, this.clientReq.self.core);
            return {
                content,
                contentType: baileys.getContentType(msg),
                ...msg,
                id: msg.key.remoteJid,
                decodedId: msg.key.remoteJid ? Functions.decodeJid(msg.key.remoteJid) : null,
                senderJid: senderJid,
                decodedSenderJid: senderJid ? Functions.decodeJid(senderJid) : null
            };
        } else {
            return null;
        }
    }
}

module.exports = MessageCollector;