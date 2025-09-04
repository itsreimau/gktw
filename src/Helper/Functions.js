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

    const type = getContentType(msg.message);
    if (!type) return "";

    const contentHandlers = {
        interactiveResponseMessage: () => {
            let text = msg.message.interactiveResponseMessage.selectedButtonId || "";
            if (!text && msg.message.interactiveResponseMessage.nativeFlowResponseMessage) {
                const params = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
                if (params) {
                    const parsedParams = JSON.parse(params);
                    text = parsedParams.id || parsedParams.selectedId || parsedParams.button_id || "";
                }
                return text;
            }
        },
        conversation: () => msg.message.conversation,
        imageMessage: () => msg.message.imageMessage?.caption || "",
        videoMessage: () => msg.message.videoMessage?.caption || "",
        documentMessageWithCaption: () => msg.message.documentMessageWithCaption?.caption || "",
        extendedTextMessage: () => msg.message.extendedTextMessage?.text || "",
        buttonsResponseMessage: () => msg.message.buttonsResponseMessage?.selectedButtonId || "",
        listResponseMessage: () => msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || "",
        templateButtonReplyMessage: () => msg.message.templateButtonReplyMessage?.selectedId || "",
        messageContextInfo: () => msg.message.buttonsResponseMessage?.selectedButtonId || msg.message.listResponseMessage?.singleSelectReply.selectedRowId || "",
        messageContextInfo: () => msg.message.templateButtonReplyMessage?.selectedId || "",
        editedMessage: () => msg.message.protocolMessage?.editedMessage?.conversation || "",
        protocolMessage: () => msg.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || msg.message.protocolMessage?.editedMessage?.conversation || msg.message.protocolMessage?.editedMessage?.imageMessage?.caption || msg.message.protocolMessage?.editedMessage?.videoMessage?.caption || ""
    };

    return contentHandlers[type]?.() || "";
};

const getSender = (msg, client) => msg.key.fromMe ? client.user.id : msg.key.participant || msg.key.remoteJid;

const lidToJid = async (client, senderLid, groupJid, force = false) => {
    const opts = groupJid ? {
        groupId: groupJid,
        force
    } : {
        force
    };
    const jid = await Baileys.lidToJid(client, senderLid, opts);
    return jid;
};

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
    lidToJid,
    decodeJid,
    getPushname,
    getId
};