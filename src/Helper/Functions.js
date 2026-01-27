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
        message: msg.protocolMessage?.editedMessage || ""
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
    return TEXT_HANDLERS[messageType]?.(extractedMessage);
}

function getDb(collection, jid) {
    if (collection.name === "users") {
        if (Baileys.isLidUser(jid))
            return collection.getOrCreate(user => user.jid === jid, {
                jid
            });
        if (Baileys.isJidUser(jid))
            return collection.getOrCreate(user => user.alt === jid, {
                alt: jid
            });
    }

    if (collection.name === "groups" && Baileys.isJidGroup(jid))
        return collection.getOrCreate(group => group.jid === jid, {
            jid
        });
}

function getPushName(jid, pushNames) {
    return pushNames[jid] || jid;
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

async function getLidUser(jid, onWhatsAppFunc) {
    if (!Baileys.isJidUser(jid)) return jid;
    return (await onWhatsAppFunc(jid))[0]?.lid || jid;
}

function checkOwner(jid, ownerList) {
    if (!jid || !Array.isArray(ownerList) || !ownerList.length) return false;
    return ownerList.some(ownerJid => Baileys.areJidsSameUser(ownerJid, jid));
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