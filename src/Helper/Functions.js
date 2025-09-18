"use strict";

const Baileys = require("baileys");

const getContentType = (msg) => {
    const _msg = Baileys.extractMessageContent(msg);
    const contentType = Baileys.getContentType(_msg);
    return contentType !== "interactiveMessage" ? contentType : Baileys.getContentType(_msg.interactiveMessage.header);
}

const getContentFromMsg = (msg) => {
    const contentType = getContentType(msg.message) ?? "";
    const contentHandlers = {
        conversation: () => msg.message.conversation,
        extendedTextMessage: () => msg.message.extendedTextMessage?.text || "",
        imageMessage: () => msg.message.imageMessage?.caption || "",
        videoMessage: () => msg.message.videoMessage?.caption || "",
        documentMessageWithCaption: () => msg.message.documentMessageWithCaption?.caption || "",
        protocolMessage: () => msg.message.protocolMessage?.editedMessage?.conversation || msg.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || msg.message.protocolMessage?.editedMessage?.imageMessage?.caption || msg.message.protocolMessage?.editedMessage?.videoMessage?.caption || "",
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
    if (/:\d+@/gi.test(jid)) {
        const decoded = Baileys.jidDecode(jid);
        return decoded?.user && decoded?.server ? Baileys.jidEncode(decoded.user, decoded.server) : jid;
    }
    return jid;
};

const getPushname = (jid, jids = {}) => {
    const decoded = decodeJid(jid);
    if (jids[decoded] && jids[decoded].pushName) return jids[decoded].pushName
    for (const [lid, data] of Object.entries(jids)) {
        if (data.pn === decoded && data.pushName) return data.pushName;
    }
    return decoded;
};

const getId = (jid) => {
    const decoded = Baileys.jidDecode(jid);
    return decoded?.user || jid;
};

const convertJid = async (type, jid, jids, client) => {
    const decoced = decodeJid(jid);
    if (type === "lid" && Baileys.isJidUser(jid)) {
        for (const [lid, data] of Object.entries(jids)) {
            if (data.pn === decoced) return lid;
        }
        try {
            const results = await client.onWhatsApp(decoced);
            if (results && results.length > 0 && results[0].exists) return results[0].jid;
        } catch {}
        return decoced;
    } else if (type === "pn" && Baileys.isLidUser(jid)) {
        if (jids[decoced] && jids[decoced].pn) return jids[decoced].pn;
        return decoced;
    }
    return decoced;
};

module.exports = {
    getContentType,
    getContentFromMsg,
    getSender,
    decodeJid,
    getPushname,
    getId,
    convertJid
};