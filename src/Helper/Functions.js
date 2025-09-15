"use strict";

const MessageType = require("../Constant/MessageType.js");
const Baileys = require("baileys");

const getContentType = (content) => {
    const keys = Object.keys(content);
    const type = keys.find(key => (key === MessageType.conversation || key.endsWith("Message") || key.endsWith("V2") || key.endsWith("V3")) && key !== MessageType.senderKeyDistributionMessage);
    return type;
};

const getContentFromMsg = (msg) => {
    if (!msg?.message) return "";

    const contentType = getContentType(msg.message);
    if (!contentType) return "";

    const contentHandlers = {
        conversation: () => msg.message.conversation,
        extendedTextMessage: () => msg.message.extendedTextMessage?.text || "",
        imageMessage: () => msg.message.imageMessage?.caption || "",
        videoMessage: () => msg.message.videoMessage?.caption || "",
        documentMessageWithCaption: () => msg.message.documentMessageWithCaption?.caption || "",
        protocolMessage: () => msg.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || msg.message.protocolMessage?.editedMessage?.conversation || msg.message.protocolMessage?.editedMessage?.imageMessage?.caption || msg.message.protocolMessage?.editedMessage?.videoMessage?.caption || "",
        buttonsMessage: () => msg.message.buttonsMessage?.contentText || "",
        interactiveMessage: () => msg.message.interactiveMessage?.body?.text || "",
        buttonsResponseMessage: () => msg.message.buttonsResponseMessage?.selectedButtonId || "",
        listResponseMessage: () => msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || "",
        templateButtonReplyMessage: () => msg.message.templateButtonReplyMessage?.selectedId || "",
        interactiveResponseMessage: () => {
            let text = msg.message.interactiveResponseMessage.selectedButtonId || "";
            if (!text && msg.message.interactiveResponseMessage.nativeFlowResponseMessage) {
                const params = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
                if (params) {
                    const parsedParams = JSON.parse(params);
                    text = parsedParams.id || parsedParams.selectedId || parsedParams.button_id || "";
                }
            }
            return text;
        }
    };

    return contentHandlers[contentType]?.() || "";
};

const getSender = (msg, client) => msg.key.fromMe ? client.user.id : msg.key.participant || msg.key.remoteJid;

const decodeJid = (jid) => {
    if (!jid) return null;

    if (/:\d+@/gi.test(jid)) {
        const decoded = Baileys.jidDecode(jid);
        return decoded?.user && decoded?.server ? Baileys.jidEncode(decoded.user, decoded.server) : jid;
    }
    return jid;
};

const getPushname = (jid, pushNames = {}) => {
    const decoded = decodeJid(jid);
    return decoded ? pushNames[decoded] || decoded : null;
};

const getId = (jid) => {
    const decoded = Baileys.jidDecode(jid);
    return decoded?.user || jid;
};

module.exports = {
    getContentType,
    getContentFromMsg,
    getSender,
    decodeJid,
    getPushname,
    getId
};