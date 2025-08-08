"use strict";

const baileys = require("baileys");
const Collector = require("./Collector.js");
const Events = require("../../Constant/Events.js");
const Functions = require("../../Helper/Functions.js");

class MessageCollector extends Collector {
    constructor(clientReq, options = {}) {
        super(options);
        this.clientReq = clientReq;
        this.jid = this.clientReq.msg.key.remoteJid;
        this.hears = options.hears || [];
        this.received = 0;
        this._collector = this._collect.bind(this);
        this.clientReq.self.ev.on(Events.MessagesUpsert, this._collector);
        this.once("end", () => {
            this.clientReq.self.ev.removeListener(Events.MessagesUpsert, this._collector);
        });
    }

    async _collect(m) {
        const [message] = m.messages;
        if (!message?.message) return null;

        const content = Functions.getContentFromMsg(message);
        const isFromTarget = this.jid === message.key.remoteJid || this.hears.includes(message.key.remoteJid);
        const shouldProcess = this.clientReq.self.selfReply ? true : !message.key.fromMe;
        if (shouldProcess && isFromTarget && content?.length) {
            this.received++;
            const msgContent = baileys.extractMessageContent(message.message);
            const senderJid = await Functions.getSender(message, this.clientReq.self.core);
            return {
                content,
                message: msgContent,
                contentType: baileys.getContentType(message.message),
                key: message.key,
                id: message.key.remoteJid,
                decodedId: message.key.remoteJid ? Functions.decodeJid(message.key.remoteJid) : null,
                senderJid: senderJid,
                decodedSenderJid: senderJid ? Functions.decodeJid(senderJid) : null
            };
        }
        return null;
    }
}

module.exports = MessageCollector;