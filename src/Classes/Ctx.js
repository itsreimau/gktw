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
        this._sender = this._self.sender;
        this._used = opts.used;
        this._args = opts.args;
        this._text = opts.text;
        this._db = this._self.db;
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
    get sender() {
        return {
            ...this._sender,
            isOwner: () => Functions.checkOwner(this._sender.lid, this._self.owner)
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
    get text() {
        return this._text;
    }
    flag(rules = {}) {
        const flags = {
            input: ""
        };
        const args = this._text.split(" ") || [];

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith("-") && flagSchema[arg]) {
                const flag = flagSchema[arg];

                if (flag.type === "boolean") {
                    flags[flag.key] = true;
                } else if (flag.type === "value" && i + 1 < args.length) {
                    const value = args[++i];
                    if (flag.validator(value)) {
                        flags[flag.key] = flag.parser ? flag.parser(value) : value;
                    }
                }
            } else if (flags.input === "") {
                flags.input = args.slice(i).join(" ");
                break;
            }
        }

        return flags;
    }
    async target(priority = ["quoted", "mentioned", "text"]) {
        let target = null;
        for (const source of priority) {
            switch (source) {
                case "quoted":
                    if (this.quoted?.sender) {
                        target = this.quoted.sender;
                        break;
                    }
                    continue;
                case "mentioned":
                    const mentioned = this.getMentioned();
                    if (mentioned.length > 0) {
                        target = mentioned[0];
                        break;
                    }
                    continue;
                case "text":
                    if (this.args.length > 0) {
                        const extractedNumber = this.args[0].replace(/[^\d]/g, "");
                        if (extractedNumber) {
                            target = extractedNumber + Baileys.S_WHATSAPP_NET;
                            break;
                        }
                    }
                    continue;
                case "text_group":
                    if (this.args.length > 0) {
                        const extractedNumber = this.args[0].replace(/[^\d]/g, "");
                        if (extractedNumber) {
                            target = `${extractedNumber}@g.us`;
                            break;
                        }
                    }
                    continue;
            }
            if (target) return await Functions.getLidUser(target, this._client.onWhatsApp);
        }

        return target;
    }

    get me() {
        const user = this._client.user;
        if (!user) return null;
        return {
            id: user.id,
            lid: user.lid,
            readyAt: this._self.readyAt
        };
    }

    get db() {
        const users = this._db.getCollection("users") || this._db.createCollection("users");
        const groups = this._db.getCollection("groups") || this._db.createCollection("groups");
        return {
            core: this._db,
            users,
            groups,
            user: Functions.getDb(users, this._sender.jid),
            group: this.isGroup() ? Functions.getDb(groups, this.id) : null
        };
    }

    async block(jid = this._sender.jid) {
        return this._client.updateBlockStatus(jid, "block");
    }

    async unblock(jid = this._sender.jid) {
        return this._client.updateBlockStatus(jid, "unblock");
    }

    async bio(content) {
        await this._client.updateProfileStatus(content);
    }

    async fetchBio(jid = this._sender.jid) {
        return await this._client.fetchStatus(jid);
    }

    get groups() {
        return new Group(this);
    }

    group(jid = this.id) {
        return Baileys.isJidGroup(jid) ? new GroupData(this, jid) : null;
    }

    isGroup() {
        return Baileys.isJidGroup(this.id);
    }
    isPrivate() {
        return Baileys.isJidUser(this.id) || Baileys.isLidUser(this.id);
    }

    getMessageType() {
        return this.msg.messageType;
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

    async getLidUser(jid = this._sender.jid) {
        return await Functions.getLidUser(jid, this._client.onWhatsApp);
    }

    getDb(collection, jid = this._sender.jid) {
        const coll = this._db.getCollection(collection) || this._db.createCollection(collection);
        return Functions.getDb(coll, jid);
    }

    async _downloadMediaMessage(msg) {
        try {
            return await Baileys.downloadMediaMessage(msg, "buffer", {}, {
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
            message,
            messageType: Functions.getMessageType(message),
            download: async () => await this._downloadMediaMessage({
                message
            }),
            upload: async () => {
                const buffer = await this._downloadMediaMessage({
                    message
                });
                return Buffer.isBuffer(buffer) ? await Baileys.uploadFile(buffer) : null;
            }
        };
    }

    get quoted() {
        const msgContext = this._msg.message?.[this.getMessageType()]?.contextInfo ?? {};
        if (!msgContext?.quotedMessage) return null;

        const message = Baileys.extractMessageContent(msgContext.quotedMessage) ?? {};
        const chat = msgContext.remoteJid || this.id;
        const sender = msgContext.participant || chat;

        return {
            text: Functions.getTextFromMsg({
                message
            }),
            message,
            messageType: Functions.getMessageType(message),
            key: {
                remoteJid: chat,
                participant: Baileys.isJidGroup(chat) ? sender : null,
                fromMe: Baileys.areJidsSameUser(sender, this.me.id),
                id: msgContext.stanzaId
            },
            id: chat,
            sender,
            pushName: Functions.getPushName(sender, this._self.pushNames),
            download: async () => await this._downloadMediaMessage({
                message
            }),
            upload: async () => {
                const buffer = await this._downloadMediaMessage({
                    message
                });
                return Buffer.isBuffer(buffer) ? await Baileys.uploadFile(buffer) : null;
            }
        };
    }

    async read() {
        await this._client.readMessages([this._msg.key]);
    }

    async reply(content, options = {}) {
        const messageContent = typeof content === "string" ? {
            text: content
        } : content;
        return await this._client.sendMessage(this.id, messageContent, {
            ...options,
            quoted: this._msg
        });
    }

    async replyWithJid(jid, content, options = {}) {
        const messageContent = typeof content === "string" ? {
            text: content
        } : content;
        return await this._client.sendMessage(jid, messageContent, {
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
}

module.exports = Ctx;