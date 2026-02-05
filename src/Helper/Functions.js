const Baileys = require("baileys");

function getMessageType(message) {
    return Baileys.getContentType(Baileys.extractMessageContent(message));
}

function getTextFromMsg(msg) {
    const extractedMessage = Baileys.extractMessageContent(msg.message);
    const messageType = getMessageType(extractedMessage) || "";

    const TEXT_HANDLERS = {
        conversation: msg => msg.conversation,
        extendedTextMessage: msg => msg.extendedTextMessage?.text || "",
        imageMessage: msg => msg.imageMessage?.caption || "",
        videoMessage: msg => msg.videoMessage?.caption || "",
        documentMessageWithCaption: msg => msg.documentMessageWithCaption?.caption || "",
        pollCreationMessage: msg => msg.pollCreationMessage.name,
        pollUpdateMessage: msg => msg.pollUpdateMessage
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
    return TEXT_HANDLERS[messageType]?.(extractedMessage);
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

async function getLidUser(jid, onWhatsAppFunc) {
    if (!Baileys.isJidUser(jid)) return jid;
    return (await onWhatsAppFunc(jid))[0]?.lid || jid;
}

function getUserData(jid, userStore, data) {
    if (!Baileys.isJidUser(jid)) return jid;
    return (data ? userStore[jid][data] : userStore) || {};
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
    if (!Baileys.isJidUser(jid) && !Baileys.isLidUser(jid)) return false;
    return ownerList.some(ownerJid => Baileys.areJidsSameUser(ownerJid, jid));
}

module.exports = {
    getMessageType,
    getTextFromMsg,
    getId,
    getLidUser,
    getUserData,
    getDb,
    checkOwner
};