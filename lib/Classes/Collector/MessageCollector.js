"use strict";

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

    _collect(msg) {
        const content = Functions.getContentFromMsg(msg);
        if (!msg.key.fromMe && (this.jid === msg.key.remoteJid || this.hears.includes(msg.key.remoteJid)) && content?.length) {
            this.received++;
            const msgType = Functions.getContentType(msg.message) || Object.keys(msg.message)[0]
            return {
                content,
                messageType: msgType,
                ...msg,
                message: baileys.extractMessageContent(msg.message[msgType]) || msg.message[msgType],
                jid: msg.key.remoteJid,
                decodedJid: msg.key.remoteJid ? Functions.decodeJid(msg.key.remoteJid) : null,
                sender: Functions.getSender(msg, this.clientReq.self.core),
                decodedSender: sender ? Functions.decodeJid(sender) : null
            };
        } else {
            return null;
        }
    }
}

module.exports = MessageCollector;