const Baileys = require("baileys");
const Functions = require("../Helper/Functions.js");
const { parseArgs } = require("node:util");
const Group = require("./Group/Group.js");
const GroupData = require("./Group/GroupData.js");
const { parseCommand } = require("../Handler/Commands.js");
const didYouMean = require("didyoumean");
const { uguu } = require("@neoxr/helper");
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
            isOwner: () => Functions.checkOwner(this._sender.jid, this._self.owner)
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
        const parsed = parseArgs({
            args: this._text.split(" "),
            options: rules,
            allowPositionals: true
        });
        return {
            input: parsed.positionals.join(" "),
            ...parsed.values
        };
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
            if (Baileys.isPnUser(target)) target = (await this.core.findUserId(target)).lid;
        }
        return target;
    }

    get me() {
        const user = this._client.user;
        if (!user) return null;
        return {
            ...user,
            readyAt: this._self.readyAt
        };
    }

    get db() {
        const bot = this._db.getCollection("bot");
        const users = this._db.getCollection("users");
        const groups = this._db.getCollection("groups");
        return {
            core: this._db,
            users,
            groups,
            bot: Functions.getDb(bot),
            user: Functions.getDb(users, this._sender.lid),
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

    group(jid = this.id, useCache = true) {
        return Baileys.isJidGroup(jid) ? new GroupData(this, jid, useCache) : null;
    }

    isGroup() {
        return Baileys.isJidGroup(this.id);
    }
    isPrivate() {
        return Baileys.isPnUser(this.id) || Baileys.isLidUser(this.id);
    }

    isCmd() {
        const {
            command,
            args,
            commandName,
            text,
            selectedPrefix
        } = parseCommand(this._self.prefix, this._msg.body);

        if (!commandName) return null;

        const commandsList = Array.from(this._self.cmd?.values() || []);
        const matchedCommands = commandsList.filter(command => command.name?.toLowerCase() === commandName || (Array.isArray(command.aliases) ? command.aliases.includes(commandName) : command.aliases === commandName));

        if (matchedCommands.length > 0)
            return {
                msg: text,
                prefix: selectedPrefix,
                name: commandName,
                input: text
            };

        const mean = didYouMean(commandName, commandsList.flatMap(cmd => [cmd.name, ...(cmd.aliases || [])]));
        return mean ? {
            msg: text,
            prefix: selectedPrefix,
            didyoumean: mean,
            input: text
        } : null;
    }

    getMessageType() {
        return this.msg.messageType;
    }

    async getMentioned(raw = true) {
        const mentions = this._msg.message?.[this.getMessageType()]?.contextInfo?.mentionedJid || [];
        if (raw) return mentions;
        const result = [];
        for (const jid of mentions) {
            const userId = await this.core.findUserId(jid);
            result.push(userId);
        }
        return result;
    }

    getDevice(id = this._msg.key.id) {
        return Baileys.getDevice(id);
    }

    getPushName(jid = this._sender.lid) {
        return Functions.getPushName(jid, this._db);
    }

    getId(jid = this._sender.jid) {
        return Functions.getId(jid);
    }

    getDb(collection, jid = this._sender.lid) {
        const coll = this._db.getCollection(collection);
        return Functions.getDb(coll, jid);
    }

    async _downloadMediaMessage(message) {
        try {
            return await Baileys.downloadMediaMessage(message, "buffer", {}, {
                logger: this._self.logger,
                reuploadRequest: this._client.updateMediaMessage
            });
        } catch {
            return null;
        }
    }

    async _uploadMediaMessage(message) {
        try {
            const buffer = await this._downloadMediaMessage(message);
            return Buffer.isBuffer(buffer) ? (await uguu(buffer)).data.url : null;
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
            download: async () =>
                await this._downloadMediaMessage({
                    message
                }),
            upload: async () =>
                await this._uploadMediaMessage({
                    message
                })
        };
    }

    get quoted() {
        const context = this._msg.message?.[this.getMessageType()]?.contextInfo || {};
        if (!context?.quotedMessage) return null;

        const message = Baileys.extractMessageContent(context.quotedMessage) || {};
        const chat = context.remoteJid || this.id;
        const sender = context.participant || chat;

        return {
            body: Functions.geBodyFromMsg({
                message
            }),
            message,
            messageType: Functions.getMessageType(message),
            key: {
                remoteJid: chat,
                id: context.stanzaId,
                fromMe: Baileys.areJidsSameUser(sender, this.me.id),
                participant: Baileys.isJidGroup(chat) ? sender : null
            },
            id: chat,
            sender,
            pushName: Functions.getPushName(sender, this._db),
            download: async () =>
                await this._downloadMediaMessage({
                    message
                }),
            upload: async () =>
                await this._uploadMediaMessage({
                    message
                })
        };
    }

    async read() {
        await this._client.readMessages([this._msg.key]);
    }

    async sendMessage(jid, content, options = {}) {
        return await this._self.sendMessage(jid, content, options);
    }

    async reply(content, options = {}) {
        return await this._self.sendMessage(this.id, content, {
            ...options,
            quoted: this._msg
        });
    }

    async replyWithJid(jid, content, options = {}) {
        return await this._self.sendMessage(jid, content, {
            ...options,
            quoted: this._msg
        });
    }

    async replyReact(emoji, key) {
        return await this._self.sendMessage(this.id, {
            react: {
                text: emoji,
                key: key || this._msg.key
            }
        });
    }

    async deleteMessage(jid, key) {
        return await this._self.sendMessage(jid, {
            delete: key
        });
    }

    async editMessage(jid, key, newText) {
        return await this._self.sendMessage(jid, {
            text: newText,
            edit: key
        });
    }

    async forwardMessage(jid, msg, force = false) {
        return await this._self.sendMessage(jid, {
            forward: msg,
            force
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