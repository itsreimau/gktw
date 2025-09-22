"use strict";

const Baileys = require("baileys");

const getContentType = (message) => {
    const messageContent = Baileys.extractMessageContent(message);
    const contentType = Baileys.getContentType(messageContent);
    return contentType !== "interactiveMessage" ? contentType : Baileys.getContentType(messageContent.interactiveMessage?.header);
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

const decodeJid = (jid) => {
    const decoded = Baileys.jidDecode(jid);
    return decoded?.user && decoded?.server ? Baileys.jidEncode(decoded.user, decoded.server) : jid;
};

const getSender = (msg, client) => {
    const {
        fromMe,
        participant,
        remoteJid
    } = msg.key;
    return fromMe ? client.user.id : participant || remoteJid;
};

const getPushname = (jid, jids = {}) => {
    if (jids[jid]?.pushName) return jids[jid].pushName;
    const matchingJid = Object.entries(jids).find(([, data]) => data.pn === jid && data.pushName);
    return matchingJid?.[1]?.pushName || jid;
};

const getId = (jid) => Baileys.jidDecode(jid)?.user || jid;

const convertJid = async (jid, type, jids, client) => {
    if (type === "lid" && Baileys.isJidUser(jid)) {
        const existingLid = Object.entries(jids).find(([, data]) => data.pn === jid);
        if (existingLid) return existingLid[0];
        const results = await client.onWhatsApp(jid);
        if (results?.[0]?.exists) return results[0].lid;
    } else if (type === "pn" && Baileys.isLidUser(jid)) {
        return jids[jid]?.pn || jid;
    }
    return jid;
};

module.exports = {
    getContentType,
    getContentFromMsg,
    getSender,
    getPushname,
    getId,
    convertJid,
    decodeJid
};