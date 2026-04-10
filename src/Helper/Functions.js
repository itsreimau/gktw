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

function checkOwner(jid, owners) {
    if (!Baileys.isPnUser(jid) && !Baileys.isLidUser(jid)) return false;
    const key = Baileys.isLidUser(jid) ? "lid" : "id";
    return owners.some(owner => Baileys.areJidsSameUser(owner[key], jid));
}

function getPn(jid, db) {
    if (Baileys.isPnUser(jid)) return jid;
    const users = db.getCollection("users");
    const userDb = getDb(users, jid);
    return userDb?.pn || null;
}

function getLid(jid, db) {
    if (Baileys.isLidUser(jid)) return jid;
    const users = db.getCollection("users");
    const userDb = getDb(users, jid);
    return userDb?.lid || null;
}

function getPushName(jid, db) {
    if (!Baileys.isPnUser(jid) && !Baileys.isLidUser(jid)) return "Unknown";
    const users = db.getCollection("users");
    const userDb = getDb(users, jid);
    return userDb?.pushName || "Unknown";
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

function getDb(collection, jid) {
    if (collection.name === "bot")
        return collection.getOrCreate(bot => bot.jid === "bot", {
            jid: "bot"
        });

    if (collection.name === "users" && Baileys.isLidUser(jid))
        return collection.getOrCreate(user => Baileys.areJidsSameUser(user.jid, jid), {
            jid
        });

    if (collection.name === "groups" && Baileys.isJidGroup(jid))
        return collection.getOrCreate(group => Baileys.areJidsSameUser(group.jid, jid), {
            jid
        });

    return null;
}

module.exports = {
    getMessageType,
    geBodyFromMsg,
    checkOwner,
    getPn,
    getLid,
    getPushName,
    getDb,
    getId
};