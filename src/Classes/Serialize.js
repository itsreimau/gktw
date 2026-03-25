const Baileys = require("baileys");
const Functions = require("../Helper/Functions.js");

class Serialize {
    constructor(core, message) {
        this.core = core;
        this.rawMessage = message;
    }

    getMessage() {
        let message = Baileys.normalizeMessageContent(this.rawMessage.message);
        const editedMessage = message?.protocolMessage?.editedMessage;
        if (editedMessage) message = Baileys.normalizeMessageContent(editedMessage);
        return message[Baileys.getContentType(message)];
    }

    getBody() {
        const message = getMessage();
        return Functions.getBodyFromMsg(message, Baileys.getContentType(message));
    }

    getQuotedMessage() {
        const quotedMessage = Baileys.normalizeMessageContent(getMessage().contextInfo.quotedMessage);
        return quotedMessage[Baileys.getContentType(quotedMessage)];
    }

    getQuotedBody() {
        const quotedMessage = getQuotedMessage();
        return Functions.getBodyFromMsg(quotedMessage, Baileys.getContentType(quotedMessage));
    }

    getSender() {
        const senderJids = [this.rawMessage.key.participant, this.rawMessage.key.participantAlt, this.rawMessage.key.remoteJid, this.rawMessage.key.remoteJidAlt];
        const senderJid = this.rawMessage.key.fromMe ? this.core.user.id : senderJids.find(jid => Baileys.isPnUser(jid));
        const senderLid = this.rawMessage.key.fromMe ? this.core.user.lid : senderJids.find(jid => Baileys.isLidUser(jid));
        return {
            jid: senderJid,
            lid: senderLid
        };
    }
}

module.exports = Serialize;