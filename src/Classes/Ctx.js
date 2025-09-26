"use strict";

const Baileys = require("baileys");
const Functions = require("../Helper/Functions.js");
const Group = require("./Group/Group.js");
const GroupData = require("./Group/GroupData.js");
const MessageCollector = require("./Collector/MessageCollector.js");

class Ctx {
    constructor(options) {
        this._used = options.used;
        this._args = options.args;
        this._self = options.self;
        this._client = options.client;
        this._msg = this._self.m;
        this._sender = {
            jid: Baileys.jidNormalizedUser(this._msg.key.participant || this._msg.key.remoteJid),
            pushName: this._msg.pushName
        };

        this._db = this._self.db;
        this._config = {
            prefix: this._self.prefix,
            cmd: this._self.cmd
        };
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
        const bot = this._db.createCollection("bot");
        const users = this._db.createCollection("users");
        const groups = this._db.createCollection("groups");

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
                    return this._checkCitation(citationName);
                }
                return undefined;
            }.bind(this)
        });
    }

    _checkCitation(citationName) {
        const citationList = this._self.citation?.[citationName];
        if (!Array.isArray(citationList)) return false;

        const botIds = new Set([this.me.id && Functions.getId(this.me.id), this.me.lid && Functions.getId(this.me.lid)].filter(Boolean));
        const senderNumber = Functions.getId(this.sender.jid);
        const isFromBot = this._msg.key.fromMe;
        const isFromBaileys = this._msg.key.id.startsWith("SUKI");

        return citationList.some(citationItem => {
            const citationString = String(citationItem);
            if (citationString.toLowerCase() === "bot") {
                if (isFromBaileys) return false;
                return isFromBot && botIds.has(senderNumber);
            }
            if (citationNumber && botIds.has(citationNumber)) {
                if (isFromBaileys) return false;
                return isFromBot && botIds.has(senderNumber);
            }
            return citationNumber === senderNumber;
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

    group(jid) {
        return new GroupData(this, jid || this.id);
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

    getDevice(id) {
        return Baileys.getDevice(id || this._msg.key.id);
    }

    decodeJid(jid) {
        return Baileys.jidNormalizedUser(jid || this.sender.jid);
    }

    getPushname(jid) {
        return Functions.getPushname(jid || this.sender.jid, this._self.pushNames);
    }

    getId(jid) {
        return Functions.getId(jid || this.sender.jid);
    }

    getDb(collection, jid) {
        return Functions.getDb(this._db.createCollection(collection || "users"), jid || this.sender.jid);
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
        const msg = this._msg;
        const message = Baileys.extractMessageContent(msg.message);

        return {
            ...msg,
            contentType: Functions.getContentType(msg.message),
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

    // Does this require taking a PN?
    get quoted() {
        const msgContext = this._msg.message?.[this.getMessageType()]?.contextInfo ?? {};
        if (!msgContext?.quotedMessage) return null;
        const quotedMessage = msgContext.quotedMessage;
        const message = Baileys.extractMessageContent(quotedMessage) ?? {};
        const chat = Baileys.jidNormalizedUser(msgContext?.remoteJid || this.id);
        const sender = Baileys.jidNormalizedUser(msgContext?.participant || chat);

        return {
            content: Functions.getContentFromMsg({
                message
            }),
            message: quotedMessage,
            messageType: Baileys.getContentType(quotedMessage) ?? "",
            contentType: Functions.getContentType(quotedMessage),
            key: {
                remoteJid: chat,
                participant: Baileys.isJidGroup(chat) ? sender : null,
                fromMe: sender && this.me.id ? Baileys.areJidsSameUser(sender, this.me.id) : false,
                id: msgContext.stanzaId
            },
            sender,
            pushName: Functions.getPushname(sender, this._self.pushNames),
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

    async sendMessage(jid, content, options = {}) {
        if ((content.header || content.footer) && !content.buttons && !content.interactiveButtons) content.interactiveButtons = [];
        if (this._self.autoAiLabel && (Baileys.isJidUser(jid) || Baileys.isLidUser(jid))) content.ai = true;

        return await this._client.sendMessage(jid, content, options);
    }

    async reply(content, options = {}) {
        if (typeof content === "string") content = {
            text: content
        };
        return await this.sendMessage(this.id, content, {
            ...options,
            quoted: this._msg
        });
    }

    async replyWithJid(jid, content, options = {}) {
        if (typeof content === "string") content = {
            text: content
        };
        return await this.sendMessage(jid, content, {
            ...options,
            quoted: this._msg
        });
    }

    async sendReact(jid, emoji, key) {
        return await this.sendMessage(jid, {
            react: {
                text: emoji,
                key: key || this._msg.key
            }
        });
    }

    async replyReact(emoji, key) {
        return await this.sendReact(this.id, emoji, key);
    }

    async deleteMessage(key) {
        return await this.sendMessage(this.id, {
            delete: key
        });
    }

    async editMessage(key, newText) {
        return await this.sendMessage(this.id, {
            text: newText,
            edit: key
        });
    }

    async forwardMessage(jid, msg) {
        return await this.sendMessage(jid, {
            forward: msg
        });
    }

    async simulateTyping() {
        await this._client.sendPresenceUpdate("composing", this.id);
    }

    async simulateRecording() {
        await this._client.sendPresenceUpdate("recording", this.id);
    }

    MessageCollector(args = {
        filter: () => {
            throw new Error("Function not implemented.");
        },
        time: 0,
        max: 0,
        maxProcessed: 0,
        hears: []
    }) {
        return new MessageCollector({
            self: this._self,
            msg: this._msg
        }, args);
    }

    awaitMessages(args = {
        filter: () => {
            throw new Error("Function not implemented.");
        },
        time: 0,
        max: 0,
        maxProcessed: 0
    }) {
        return new Promise((resolve, reject) => {
            const collector = this.MessageCollector(args);
            collector.once("end", (collected, reason) => {
                if (args.endReason.includes(reason)) {
                    reject(collected);
                } else {
                    resolve(collected);
                }
            });
        });
    }
}

module.exports = Ctx;