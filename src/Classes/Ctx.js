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
            jid: Functions.getSender(this._msg, this._client),
            decodedJid: null,
            pn: Functions.getSender(this._msg, this._client, "pn"),
            decodedPn: null,
            pushName: this._msg.pushName
        };

        if (this._sender.jid && this._msg.key.fromMe) {
            this._sender.decodedJid = Baileys.jidNormalizedUser(this._sender.jid);
        } else {
            this._sender.decodedJid = this._sender.jid;
        }

        if (this._sender.pn && this._msg.key.fromMe) {
            this._sender.decodedPn = Baileys.jidNormalizedUser(this._sender.pn);
        } else {
            this._sender.decodedJid = this._sender.jid;
        }

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
        return this._msg.key.remoteJid;
    }

    get decodedId() {
        return this.id && this._msg.key.fromMe ? Baileys.jidNormalizedUser(this.id) : this.id;
    }

    get sender() {
        return this._sender;
    }

    get me() {
        const user = this._client.user;
        if (!user) return null;
        return {
            ...user,
            decodedId: Baileys.jidNormalizedUser(user.id),
            decodedLid: Baileys.jidNormalizedUser(user.lid),
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

    get keyDb() {
        return {
            user: Functions.getId(this._sender.jid),
            userPn: Functions.getId(this._sender.pn),
            group: Functions.getId(this.id)
        }
    }

    async block(jid) {
        const target = jid ? (this._msg.key.fromMe ? Baileys.jidNormalizedUser(jid) : jid) : this._sender.decodedJid;
        return this._client.updateBlockStatus(target, "block");
    }

    async unblock(jid) {
        const target = jid ? (this._msg.key.fromMe ? Baileys.jidNormalizedUser(jid) : jid) : this._sender.decodedJid;
        return this._client.updateBlockStatus(target, "unblock");
    }

    async bio(content) {
        await this._client.updateProfileStatus(content);
    }

    async fetchBio(jid) {
        const decodedJid = jid ? (this._msg.key.fromMe ? Baileys.jidNormalizedUser(jid) : jid) : this.me.decodedId;
        return await this._client.fetchStatus(decodedJid);
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
        return Functions.getPushname(jid || this.sender.jid, this._msg.key.fromMe, this._self.pushNames);
    }

    getId(jid) {
        return Functions.getId(jid || this.sender.jid);
    }

    async getMediaMessage(msg, type) {
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
                toBuffer: async () => await this.getMediaMessage({
                    message
                }, "buffer"),
                toStream: async () => await this.getMediaMessage({
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
        const chat = msgContext?.remoteJid || this.id;
        const sender = msgContext?.participant || chat;
        const fromMe = sender && this.me.decodedId ? Baileys.areJidsSameUser(Baileys.jidNormalizedUser(sender), this.me.decodedId) : false;

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
                fromMe,
                id: msgContext.stanzaId
            },
            sender,
            pushName: Functions.getPushname(sender, fromMe, this._self.pushNames),
            media: {
                toBuffer: async () => await this.getMediaMessage({
                    message
                }, "buffer"),
                toStream: async () => await this.getMediaMessage({
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