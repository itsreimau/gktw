"use strict";

const Baileys = require("baileys");

const getContentType = (message) => {
    const messageContent = Baileys.extractMessageContent(message);
    return Baileys.getContentType(messageContent);
};

const CONTENT_HANDLERS = {
    conversation: (msg) => msg.conversation,
    extendedTextMessage: (msg) => msg.extendedTextMessage?.text || "",
    imageMessage: (msg) => msg.imageMessage?.caption || "",
    videoMessage: (msg) => msg.videoMessage?.caption || "",
    documentMessageWithCaption: (msg) => msg.documentMessageWithCaption?.caption || "",
    protocolMessage: (msg) => {
        const editedMessage = msg.protocolMessage?.editedMessage;
        return editedMessage?.conversation || editedMessage?.extendedTextMessage?.text || editedMessage?.imageMessage?.caption || editedMessage?.videoMessage?.caption || "";
    },
    buttonsMessage: (msg) => msg.buttonsMessage?.contentText || "",
    interactiveMessage: (msg) => msg.interactiveMessage?.body?.text || "",
    buttonsResponseMessage: (msg) => msg.buttonsResponseMessage?.selectedButtonId || "",
    listResponseMessage: (msg) => msg.listResponseMessage?.singleSelectReply?.selectedRowId || "",
    templateButtonReplyMessage: (msg) => msg.templateButtonReplyMessage?.selectedId || "",
    interactiveResponseMessage: (msg) => {
        const interactiveMsg = msg.interactiveResponseMessage;
        let text = interactiveMsg?.selectedButtonId || "";
        if (!text && interactiveMsg?.nativeFlowResponseMessage) {
            const params = JSON.parse(interactiveMsg.nativeFlowResponseMessage.paramsJson || "{}");
            text = params.id || params.selectedId || params.button_id || "";
        }
        return text;
    }
};

const getContentFromMsg = (msg) => {
    const contentType = getContentType(msg.message) ?? "";
    const handler = CONTENT_HANDLERS[contentType];
    return handler ? handler(msg.message) : "";
};

const getSender = (msg, client, address = "lid") => {
    if (msg.key.fromMe) return address === "lid" ? client.user.lid : client.user.id;
    if (address === "lid") return msg.key.participant || msg.key.remoteJid;
    return msg.key.participantAlt || msg.key.remoteJidAlt;
};

const getPushname = (jid, fromMe, pushNames = {}) => {
    const decoded = fromMe ? Baileys.jidNormalizedUser(jid) : jid;
    return decoded ? pushNames[decoded] || decoded : null;
};

const getId = (jid) => Baileys.jidDecode(jid)?.user || jid;

module.exports = {
    getContentType,
    getContentFromMsg,
    getSender,
    getPushname,
    getId
};