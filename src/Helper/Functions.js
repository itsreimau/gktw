const Baileys = require("baileys");

function getMessageType(message) {
    return Baileys.getContentType(Baileys.extractMessageContent(message));
}

function geBodyFromMsg(msg) {
    const extractedMessage = Baileys.extractMessageContent(msg.message);
    const BODY_HANDLERS = {
        conversation: (msg) => msg.conversation || "",
        extendedTextMessage: (msg) => msg.extendedTextMessage?.text || "",
        imageMessage: (msg) => msg.imageMessage?.caption || "",
        videoMessage: (msg) => msg.videoMessage?.caption || "",
        documentMessageWithCaption: (msg) => msg.documentMessageWithCaption?.caption || "",
        protocolMessage: (msg) =>
            geBodyFromMsg({
                message: msg.protocolMessage?.editedMessage || ""
            }),
        buttonsMessage: (msg) => msg.buttonsMessage?.contentText || "",
        interactiveMessage: (msg) => msg.interactiveMessage?.body?.text || "",
        buttonsResponseMessage: (msg) => msg.buttonsResponseMessage?.selectedButtonId || "",
        listResponseMessage: (msg) => msg.listResponseMessage?.singleSelectReply?.selectedRowId || "",
        templateButtonReplyMessage: (msg) => msg.templateButtonReplyMessage?.selectedId || "",
        interactiveResponseMessage: (msg) => {
            const interactiveMsg = msg.interactiveResponseMessage;
            let body = interactiveMsg?.selectedButtonId || "";
            if (!body && interactiveMsg?.nativeFlowResponseMessage) {
                const params = JSON.parse(interactiveMsg.nativeFlowResponseMessage.paramsJson || "{}");
                body = params.id || params.selectedId || params.button_id || "";
            }
            return body;
        }
    };
    return BODY_HANDLERS[getMessageType(extractedMessage)]?.(extractedMessage);
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

function getPushName(jid, pushNames) {
    if (!Baileys.isLidUser(jid)) return "Unknown";
    return pushNames[jid] || "Unknown";
}

function getDb(collection, jid) {
    if (collection.name === "bot")
        return collection.getOrCreate(bot => bot.jid === "bot", {
            jid: "bot"
        });

    if (collection.name === "users" && Baileys.isLidUser(jid))
        return collection.getOrCreate(user => user.jid === jid, {
            jid
        });

    if (collection.name === "groups" && Baileys.isJidGroup(jid))
        return collection.getOrCreate(group => group.jid === jid, {
            jid
        });

    return null;
}

function checkOwner(jid, ownerList) {
    if (!Baileys.isPnUser(jid) && !Baileys.isLidUser(jid)) return false;
    return ownerList.some(ownerJid => Baileys.areJidsSameUser(ownerJid, jid));
}

module.exports = {
    getMessageType,
    geBodyFromMsg,
    getId,
    getPushName,
    getDb,
    checkOwner
};