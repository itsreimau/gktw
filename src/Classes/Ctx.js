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
            pushName: this._msg.pushName
        };

        if (this._sender.jid) this._sender.decodedJid = Functions.decodeJid(this._sender.jid);

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
        return this.id ? Functions.decodeJid(this.id) : null;
    }

    get sender() {
        return this._sender;
    }

    get me() {
        let user = this._client.user;
        if (user) {
            user.decodedId = Functions.decodeJid(user.id);
            user.readyAt = this._self.readyAt;
        }
        return user;
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

    async block(jid) {
        const target = jid ? Functions.decodeJid(jid) : Functions.decodeJid(this.id);
        return this._client.updateBlockStatus(target, "block");
    }

    async unblock(jid) {
        const target = jid ? Functions.decodeJid(jid) : Functions.decodeJid(this.id);
        return this._client.updateBlockStatus(target, "unblock");
    }

    async bio(content) {
        await this._client.updateProfileStatus(content);
    }

    async fetchBio(jid) {
        const decodedJid = Functions.decodeJid(jid ? jid : this._client.user.id);
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

    getMessageType() {
        return this._msg.messageType;
    }

    getContentType() {
        const msg = Baileys.extractMessageContent(this._msg);
        return Functions.getContentType(msg);
    }

    getMentioned() {
        return this._msg.message?.[this.getMessageType()]?.contextInfo?.mentionedJid || [];
    }

    getDevice(id) {
        return Baileys.getDevice(id || this._msg.key.id);
    }

    decodeJid(jid) {
        return Functions.decodeJid(jid);
    }

    getPushname(jid) {
        return Functions.getPushname(jid, this._self.pushNames);
    }

    getId(jid) {
        return Functions.getId(jid);
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
        const rawMsg = this._msg;
        const msg = Baileys.extractMessageContent(rawMsg.message);

        return {
            ...rawMsg,
            contentType: this.getContentType(msg),
            media: {
                toBuffer: async () => await this.getMediaMessage({
                    message: msg
                }, "buffer"),
                toStream: async () => await this.getMediaMessage({
                    message: msg
                }, "stream")
            }
        };
    }

    get quoted() {
        const msgContext = this._msg.message?.[this.getMessageType()]?.contextInfo ?? {};
        if (!msgContext?.quotedMessage) return null;
        const message = Baileys.extractMessageContent(msgContext.quotedMessage) ?? {};
        const chatId = msgContext?.remoteJid || this.id;
        const senderJid = msgContext?.participant || chatId;

        return {
            content: Functions.getContentFromMsg({
                message
            }),
            message: msgContext.quotedMessage,
            messageType: Functions.getContentType(msgContext.quotedMessage) || Object.keys(msgContext.quotedMessage)[0],
            contentType: Functions.getContentType(message),
            key: {
                remoteJid: chatId,
                participant: Baileys.isJidGroup(chatId) ? senderJid : null,
                fromMe: senderJid && this._client.user.id ? Baileys.areJidsSameUser(Functions.decodeJid(senderJid), Functions.decodeJid(this._client.user.id)) : false,
                id: msgContext.stanzaId
            },
            senderJid,
            decodedSenderJid: Functions.decodeJid(senderJid),
            pushName: Functions.getPushname(senderJid, this._self.pushNames),
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

    read() {
        const m = this._msg;
        this._client.readMessages([{
            remoteJid: m.key.remoteJid,
            id: m.key.id,
            participant: m.key.participant
        }]);
    }

    async sendMessage(jid, content, options = {}) {
        if (this._self.autoMention) {
            const extractMentions = (text) => {
                if (!text) return [];
                const mentions = (text.match(/@(\d+)/g) || []);
                return mentions.map(mention => mention.replace("@", "") + Baileys.S_WHATSAPP_NET);
            };

            const allMentions = [...extractMentions(content.text), ...extractMentions(content.caption), ...extractMentions(content.header), ...extractMentions(content.footer)].filter(Boolean);
            if (allMentions.length > 0) content.mentions = [...(content.mentions || []), ...allMentions.filter(mention => !(content.mentions || []).includes(mention))];
        }

        if (content.buttons) {
            content.buttons = content.buttons.map(button => {
                if (!button.type) button.type = 1;
                return button;
            });
            if (!content.headerType) content.headerType = 1;
        }

        if ((content.header || content.footer) && !content.buttons && !content.interactiveButtons) content.interactiveButtons = [];
        if (content.image || content.video || (content.product && ((content.interactiveButtons && content.interactiveButtons.length > 0) || (content.buttons && content.buttons.length > 0)))) content.media = true;
        if (this._self.autoAiLabel && Baileys.isJidUser(jid)) content.ai = true;

        return this._client.sendMessage(jid, content, options);
    }

    async reply(content, options = {}) {
        if (typeof content === "string") content = {
            text: content
        };
        return this.sendMessage(this.id, content, {
            ...options,
            quoted: this._msg
        });
    }

    async replyWithJid(jid, content, options = {}) {
        if (typeof content === "string") content = {
            text: content
        };
        return this.sendMessage(jid, content, {
            ...options,
            quoted: this._msg
        });
    }

    async sendReact(jid, emoji, key) {
        return this.sendMessage(jid, {
            react: {
                text: emoji,
                key: key || this._msg.key
            }
        });
    }

    async replyReact(emoji, key) {
        return this.sendReact(this.id, emoji, key);
    }

    async deleteMessage(key) {
        return this.sendMessage(this.id, {
            delete: key
        });
    }

    async editMessage(key, newText) {
        return this.sendMessage(this.id, {
            text: newText,
            edit: key
        });
    }

    async forwardMessage(jid, msg) {
        return this.sendMessage(jid, {
            forward: msg
        });
    }

    simulateTyping() {
        this._client.sendPresenceUpdate("composing", this.id);
    }

    simulateRecording() {
        this._client.sendPresenceUpdate("recording", this.id);
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
            const col = this.MessageCollector(args);
            col.once("end", (collected, reason) => {
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