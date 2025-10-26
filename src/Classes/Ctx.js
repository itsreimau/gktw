const Baileys = require("baileys");
const Functions = require("../Helper/Functions.js");
const Group = require("./Group/Group.js");
const GroupData = require("./Group/GroupData.js");
const MessageCollector = require("./Collector/MessageCollector.js");

class Ctx {
    constructor(opts) {
        this._self = opts.self;
        this._client = opts.client;
        this._msg = this._self.m;
        this._sender = {
            jid: Baileys.jidNormalizedUser(this._msg.key.participant || this._msg.key.remoteJid),
            pushName: this._msg.pushName
        };
        this._used = opts.used;
        this._args = opts.args;
        this._db = this._self.db;
    }

    get bot() {
        return this._self;
    }

    get core() {
        return this._client;
    }

    get id() {
        return Baileys.jidNormalizedUser(this._msg.key.remoteJid);
    }

    get sender() {
        return this._sender;
    }

    get me() {
        const user = this._client.user;
        if (!user) return null;
        return {
            id: Baileys.jidNormalizedUser(user.id),
            lid: Baileys.jidNormalizedUser(user.lid),
            readyAt: this._self.readyAt
        };
    }

    get store() {
        return this._self.store;
    }

    get used() {
        return this._used;
    }

    get args() {
        return this._args;
    }

    get db() {
        const bot = this._db.getCollection("bot") || this._db.createCollection("bot");
        const users = this._db.getCollection("users") || this._db.createCollection("users");
        const groups = this._db.getCollection("groups") || this._db.createCollection("groups");

        return {
            core: this._db,
            users,
            groups,
            bot: Functions.getDb(bot, this.me.lid),
            user: Functions.getDb(users, this._sender.jid),
            group: this.isGroup() ? Functions.getDb(groups, this.id) : null
        };
    }

    get citation() {
        return new Proxy({}, {
            get: (target, prop) => {
                if (typeof prop === "string" && prop.startsWith("is")) {
                    const citationName = prop.substring(2).toLowerCase();
                    return Functions.checkCitation(this._msg, citationName, this._self.citation, this._client)
                }
                return null;
            }
        });
    }

    async block(jid) {
        const target = jid ? Baileys.jidNormalizedUser(jid) : this._sender.jid;
        return this._client.updateBlockStatus(target, "block");
    }

    async unblock(jid) {
        const target = jid ? Baileys.jidNormalizedUser(jid) : this._sender.jid;
        return this._client.updateBlockStatus(target, "unblock");
    }

    async bio(content) {
        await this._client.updateProfileStatus(content);
    }

    async fetchBio(jid) {
        const target = jid ? Baileys.jidNormalizedUser(jid) : this._sender.jid;
        return await this._client.fetchStatus(target);
    }

    get groups() {
        return new Group(this);
    }

    group(jid = this.id) {
        if (!Baileys.isJidGroup(jid)) return null;
        return new GroupData(this, jid);
    }

    isGroup() {
        return Baileys.isJidGroup(this.id);
    }

    isPrivate() {
        return Baileys.isJidUser(this.id) || Baileys.isLidUser(this.id);
    }

    getMessageType() {
        return this._msg.messageType;
    }

    getContentType() {
        return Baileys.getContentType(this._msg.message);
    }

    getMentioned() {
        return this._msg.message?.[this.getMessageType()]?.contextInfo?.mentionedJid || [];
    }

    getDevice(id = this._msg.key.id) {
        return Baileys.getDevice(id);
    }

    getPushName(jid = this._sender.jid) {
        return Functions.getPushName(jid, this._self.pushNames);
    }

    getId(jid = this._sender.jid) {
        return Functions.getId(jid);
    }

    getDb(collection, jid = this._sender.jid) {
        return Functions.getDb(this._db.getCollection(collection) || this._db.createCollection(collection), jid);
    }

    async _getMediaMessage(msg, type) {
        try {
            return await Baileys.downloadMediaMessage(msg, type, {}, {
                logger: this._self.logger,
                reuploadRequest: this._client.updateMediaMessage
            });
        } catch {
            return null;
        }
    }

    get msg() {
        const message = Baileys.extractMessageContent(this._msg.message);
        return {
            ...this._msg,
            contentType: Functions.getContentType(this._msg.message),
            media: {
                toBuffer: async () => await this._getMediaMessage({
                    message
                }, "buffer"),
                toStream: async () => await this._getMediaMessage({
                    message
                }, "stream")
            }
        };
    }

    get quoted() {
        const msgContext = this._msg.message?.[this.getMessageType()]?.contextInfo ?? {};
        if (!msgContext?.quotedMessage) return null;

        const quotedMessage = msgContext.quotedMessage;
        const message = Baileys.extractMessageContent(quotedMessage) ?? {};
        const chat = Baileys.jidNormalizedUser(msgContext.remoteJid || this.id);
        const sender = Baileys.jidNormalizedUser(msgContext.participant || chat);

        return {
            content: Functions.getContentFromMsg({
                message: quotedMessage
            }),
            message: quotedMessage,
            messageType: Baileys.getContentType(quotedMessage) ?? "",
            contentType: Functions.getContentType(quotedMessage),
            key: {
                remoteJid: chat,
                participant: Baileys.isJidGroup(chat) ? sender : null,
                fromMe: Baileys.isLidUser(sender) ? Baileys.areJidsSameUser(sender, this.me.lid) : Baileys.areJidsSameUser(sender, this.me.id),
                id: msgContext.stanzaId
            },
            id: chat,
            sender,
            pushName: Functions.getPushName(sender, this._self.pushNames),
            media: {
                toBuffer: async () => await this._getMediaMessage({
                    message
                }, "buffer"),
                toStream: async () => await this._getMediaMessage({
                    message
                }, "stream")
            }
        };
    }

    async read() {
        await this._client.readMessages([this._msg.key]);
    }

    async reply(content, options = {}) {
        if (typeof content === "string") content = {
            text: content
        };
        return await this._client.sendMessage(this.id, content, {
            ...options,
            quoted: this._msg
        });
    }

    async replyWithJid(jid, content, options = {}) {
        if (typeof content === "string") content = {
            text: content
        };
        return await this._client.sendMessage(jid, content, {
            ...options,
            quoted: this._msg
        });
    }

    async replyReact(emoji, key) {
        return await this._client.sendMessage(this.id, {
            react: {
                text: emoji,
                key: key || this._msg.key
            }
        });
    }

    async deleteMessage(key, jid = this.id) {
        return await this._client.sendMessage(jid, {
            delete: key
        });
    }

    async editMessage(key, newText, jid = this.id) {
        return await this._client.sendMessage(jid, {
            text: newText,
            edit: key
        });
    }

    async forwardMessage(jid, msg) {
        return await this._client.sendMessage(jid, {
            forward: msg
        });
    }

    async simulateTyping() {
        await this._client.sendPresenceUpdate("composing", this.id);
    }

    async simulateRecording() {
        await this._client.sendPresenceUpdate("recording", this.id);
    }

    MessageCollector(args) {
        return new MessageCollector({
            self: this._self,
            msg: this._msg
        }, args);
    }

    awaitMessages(args) {
        return new Promise((resolve, reject) => {
            const collector = this.MessageCollector(args);
            collector.once("end", (collected, reason) => {
                resolve(collected);
            });
        });
    }
}

module.exports = Ctx;