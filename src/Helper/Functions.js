const Baileys = require("baileys");

function getBodyFromMsg(message, mesageType) {
    return message && (message?.text || message?.caption || message?.name || message?.selectedId || message?.selectedButtonId || message.singleSelectReply?.selectedRowId || (type === "interactiveResponseMessage" && JSON.parse(message.nativeFlowResponseMessage.paramsJson).id) || message?.contentText || message.body?.text || "");
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
    getBodyFromMsg,
    getId,
    getPushName,
    getDb,
    checkOwner
};