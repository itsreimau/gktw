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
        return getContentFromMsg(editedMessage) ?? "";
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

const getDb = (collection, jid) => {
    const decoded = Baileys.jidNormalizedUser(jid);
    if (Baileys.isJidGroup(decoded)) {
        return collection.getOrCreate(group => group.jid === decoded, {
            jid: decoded
        });
    } else if (Baileys.isLidUser(decoded)) {
        return collection.getOrCreate(user => user.jid === decoded, {
            jid: decoded
        });
    } else {
        return collection.getOrCreate(user => user.alt === decoded, {
            alt: decoded
        });
    }
};

const getPushname = (jid, pushNames = {}) => {
    const decoded = Baileys.jidNormalizedUser(jid);
    return decoded ? pushNames[decoded] || decoded : null;
};

const getId = (jid) => Baileys.jidDecode(jid)?.user || jid;

module.exports = {
    getContentType,
    getContentFromMsg,
    getDb,
    getPushname,
    getId
};