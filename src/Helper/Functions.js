const Baileys = require("baileys");

function getMessageType(message) {
    const messageContent = Baileys.extractMessageContent(message);
    return Baileys.getContentType(messageContent);
}

const CONTENT_HANDLERS = {
    conversation: msg => msg.conversation,
    extendedTextMessage: msg => msg.extendedTextMessage?.text || "",
    imageMessage: msg => msg.imageMessage?.caption || "",
    videoMessage: msg => msg.videoMessage?.caption || "",
    documentMessageWithCaption: msg => msg.documentMessageWithCaption?.caption || "",
    protocolMessage: msg => getContentFromMsg({
        message: msg.protocolMessage?.editedMessage
    }),
    viewOnceMessage: msg => getContentFromMsg({
        message: msg.viewOnceMessage?.message
    }),
    viewOnceMessageV2: msg => getContentFromMsg({
        message: msg.viewOnceMessageV2?.message
    }),
    buttonsMessage: msg => msg.buttonsMessage?.contentText || "",
    interactiveMessage: msg => msg.interactiveMessage?.body?.text || "",
    buttonsResponseMessage: msg => msg.buttonsResponseMessage?.selectedButtonId || "",
    listResponseMessage: msg => msg.listResponseMessage?.singleSelectReply?.selectedRowId || "",
    templateButtonReplyMessage: msg => msg.templateButtonReplyMessage?.selectedId || "",
    interactiveResponseMessage: msg => {
        const interactiveMsg = msg.interactiveResponseMessage;
        let text = interactiveMsg?.selectedButtonId || "";
        if (!text && interactiveMsg?.nativeFlowResponseMessage) {
            const params = JSON.parse(interactiveMsg.nativeFlowResponseMessage.paramsJson || "{}");
            text = params.id || params.selectedId || params.button_id || "";
        }
        return text;
    }
};

function getContentFromMsg(msg) {
    const extracted = Baileys.extractMessageContent(msg.message);
    const messageType = getMessageType(extracted) ?? "";
    return CONTENT_HANDLERS[messageType]?.(extracted) || "";
}

function getDb(collection, jid) {
    const normalized = Baileys.jidNormalizedUser(jid);
    if (["bot", "users"].includes(collection.name) && Baileys.isLidUser(normalized)) return collection.getOrCreate(user => user.jid === normalized, {
        jid: normalized
    });
    if (["bot", "users"].includes(collection.name) && Baileys.isJidUser(normalized)) return collection.getOrCreate(user => user.alt === normalized, {
        alt: normalized
    });
    if (collection.name === "groups" && Baileys.isJidGroup(normalized)) return collection.getOrCreate(group => group.jid === normalized, {
        jid: normalized
    });
}

function getPushName(jid, pushNames) {
    const normalized = Baileys.jidNormalizedUser(jid);
    return normalized ? pushNames[normalized] || normalized : null;
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

async function getLidUser(jid, onWhatsAppFunc) {
    return (await onWhatsAppFunc(jid))[0]?.lid || jid;
}

function checkCitation(msg, citationName, citation, botJid) {
    if (!msg || !citationName || !citation[citationName]) return false;

    const citationJids = citation[citationName];
    const senderJid = Baileys.jidNormalizedUser(typeof msg === "string" ? msg : (msg.key.participant || msg.key.remoteJid));

    return citationJids.some(citationJid => {
        const isBotCitation = citationJid === "bot" || Baileys.areJidsSameUser(citationJid, botJid);
        const isFromBot = msg.key?.fromMe && !msg.key.id?.startsWith("3EB0") && Baileys.areJidsSameUser(senderJid, botJid);
        return Baileys.areJidsSameUser(citationJid, senderJid) || (isBotCitation && isFromBot);
    });
}

module.exports = {
    getMessageType,
    getContentFromMsg,
    getDb,
    getPushName,
    getId,
    getLidUser,
    checkCitation
};