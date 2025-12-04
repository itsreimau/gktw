const Baileys = require("baileys");

function getMessageType(message) {
    return Baileys.getContentType(Baileys.extractMessageContent(message));
}

const TEXT_HANDLERS = {
    conversation: msg => msg.conversation,
    extendedTextMessage: msg => msg.extendedTextMessage?.text || "",
    imageMessage: msg => msg.imageMessage?.caption || "",
    videoMessage: msg => msg.videoMessage?.caption || "",
    documentMessageWithCaption: msg => msg.documentMessageWithCaption?.caption || "",
    protocolMessage: msg => getTextFromMsg({
        message: msg.protocolMessage?.editedMessage
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

function getTextFromMsg(msg) {
    const extractedMessage = Baileys.extractMessageContent(msg.message);
    const messageType = getMessageType(extractedMessage) ?? "";
    return TEXT_HANDLERS[messageType]?.(extractedMessage) || "";
}

function getDb(collection, jid) {
    const normalizedJid = Baileys.jidNormalizedUser(jid);

    if (collection.name === "users") {
        if (Baileys.isLidUser(normalizedJid)) return collection.getOrCreate(user => user.jid === normalizedJid, {
            jid: normalizedJid
        });
        if (Baileys.isJidUser(normalizedJid)) return collection.getOrCreate(user => user.alt === normalizedJid, {
            alt: normalizedJid
        });
    }

    if (collection.name === "groups" && Baileys.isJidGroup(normalizedJid)) return collection.getOrCreate(group => group.jid === normalizedJid, {
        jid: normalizedJid
    });
}

function getPushName(jid, pushNames) {
    const normalizedJid = Baileys.jidNormalizedUser(jid);
    return normalizedJid ? pushNames[normalizedJid] || normalizedJid : null;
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

async function getLidUser(jid, onWhatsAppFunc) {
    return (await onWhatsAppFunc(jid))[0]?.lid || jid;
}

function checkOwner(key, ownerList, botJid) {
    if (!key || !Array.isArray(ownerList) || !ownerList.length) return false;

    const senderJid = Baileys.jidNormalizedUser(typeof key === "string" ? key : (key.participant || key.remoteJid));
    return ownerList.some(ownerJid => {
        const isBotOwner = ownerJid === "bot" || Baileys.areJidsSameUser(ownerJid, botJid);
        const isFromBot = key?.fromMe && !key.id?.startsWith("3EB0") && Baileys.areJidsSameUser(senderJid, botJid);
        return Baileys.areJidsSameUser(ownerJid, senderJid) || (isBotOwner && isFromBot);
    });
}

module.exports = {
    getMessageType,
    getTextFromMsg,
    getDb,
    getPushName,
    getId,
    getLidUser,
    checkOwner
};