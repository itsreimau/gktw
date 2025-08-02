"use strict";

const {
    jidDecode
} = require("baileys");
const fs = require("fs");
const path = require("path");

const arrayMove = (arr, oldIndex, newIndex) => {
    if (oldIndex < 0 || oldIndex >= arr.length) return arr;

    const item = arr[oldIndex];
    const newArr = [...arr];

    newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, item);

    return newArr;
};

const getContentType = (content) => {
    const keys = Object.keys(content)
    const key = keys.find(key => (key === "conversation" || key.endsWith("Message") || key.endsWith("V2") || key.endsWith("V3")) && key !== "senderKeyDistributionMessage")
    return key;
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

const getSender = (msg, client) => {
    return msg.key.fromMe ? client.user?.id : msg.participant || msg.key.participant || msg.key.remoteJid;
};

const walk = (dir, callback) => {
    if (!fs.existsSync(dir)) return;

    const processEntry = (entry) => {
        const filepath = path.join(dir, entry);
        const stats = fs.statSync(filepath);

        if (stats.isDirectory()) {
            walk(filepath, callback);
        } else if (stats.isFile()) {
            callback(filepath, stats);
        }
    };

    fs.readdirSync(dir).forEach(processEntry);
};

const decodeJid = (jid) => {
    if (!jid) return null;

    if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid);
        return decoded?.user && decoded?.server ? `${decoded.user}@${decoded.server}` : jid;
    }
    return jid;
};

const getPushname = (jid, pushNames = {}) => {
    const decoded = decodeJid(jid);
    return decoded ? pushNames[decoded] || decoded : null;
};

const getId = (jid) => {
    const decoded = jidDecode(jid);
    return decoded?.user || jid;
};

function cleanNullish(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    if (obj instanceof Date || obj instanceof RegExp) return obj;

    if (Array.isArray(obj)) return obj.filter(item => item !== null && item !== undefined).map(cleanNullish).filter(item => !(typeof item === "object" && Object.keys(item).length === 0));

    const cleaned = {};
    let hasValues = false;

    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;

        const cleanedValue = cleanNullish(value);
        if (cleanedValue === undefined || (typeof cleanedValue === "object" && Object.keys(cleanedValue).length === 0)) continue;

        cleaned[key] = cleanedValue;
        hasValues = true;
    }

    return hasValues ? cleaned : undefined;
}

module.exports = {
    arrayMove,
    getContentType,
    getContentFromMsg,
    getSender,
    walk,
    decodeJid,
    getPushname,
    getId,
    cleanNullish
};