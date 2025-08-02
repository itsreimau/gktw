"use strict";

const baileys = require("baileys");
const pino = require("pino");
const EventEmitter = require("events");
const {
    Collection
} = require("@discordjs/collection");
const {
    Consolefy
} = require("@mengkodingan/consolefy");
const {
    NodeCache
} = require("@cacheable/node-cache");
const Events = require("../Constant/Events.js");
const fs = require("fs");
const Functions = require("../Helper/Functions.js");
const ExtractEventsContent = require("../Handler/ExtractEventsContent.js");
const Ctx = require("./Ctx.js");
const MessageEventList = require("../Handler/MessageEvents.js");
const PHONENUMBER_MCC = require("../Constant/PHONENUMBER_MCC.js");

class Client {
    constructor(opts) {
        this.prefix = opts.prefix;
        this.readIncommingMsg = opts.readIncommingMsg ?? false;
        this.authDir = opts.authDir ?? "./state";
        this.printQRInTerminal = opts.printQRInTerminal ?? true;
        this.phoneNumber = opts.phoneNumber;
        this.usePairingCode = opts.usePairingCode ?? false;
        this.customPairingCode = opts.customPairingCode ?? false;
        this.qrTimeout = opts.qrTimeout ?? 60000;
        this.markOnlineOnConnect = opts.markOnlineOnConnect ?? true;
        this.logger = opts.logger ?? pino({
            level: "fatal"
        });
        this.selfReply = opts.selfReply ?? false;
        this.WAVersion = opts.WAVersion;
        this.autoMention = opts.autoMention ?? false;
        this.fallbackWAVersion = [2, 3000, 1021387508];
        this.authAdapter = opts.authAdapter ?? baileys.useMultiFileAuthState(this.authDir);
        this.browser = opts.browser ?? baileys.Browsers.ubuntu("CHROME");

        this.ev = new EventEmitter();
        this.cmd = new Collection();
        this.cooldown = new Collection();
        this.hearsMap = new Collection();
        this.middlewares = new Collection();
        this.consolefy = new Consolefy();
        this.pushnamesPath = `${this.authDir}/pushnames.json`;
        this.pushNames = {};
        this.groupCache = new NodeCache({
            stdTTL: 5 * 60,
            useClones: false
        });
        this.duplicateMessages = new NodeCache({
            stdTTL: 60,
            useClones: false
        });

        if (typeof this.prefix === "string") this.prefix = this.prefix.split("");
    }

    onConnectionUpdate() {
        this.core.ev.on("connection.update", (update) => {
            this.ev.emit(Events.ConnectionUpdate, update);
            const {
                connection,
                lastDisconnect
            } = update;

            if (update.qr) this.ev.emit(Events.QR, update.qr);

            if (connection === "close") {
                const shouldReconnect = lastDisconnect.error.output.statusCode !== baileys.DisconnectReason.loggedOut;
                this.consolefy.error(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
                if (shouldReconnect) this.launch();
            } else if (connection === "open") {
                this.readyAt = Date.now();
                this.ev.emit(Events.ClientReady, this.core);
            }
        });
    }

    onCredsUpdate() {
        this.core.ev.on("creds.update", this.saveCreds);
    }

    savePushnames() {
        fs.writeFileSync(this.pushnamesPath, JSON.stringify(this.pushNames));
    }

    read(m) {
        this.core.readMessages([{
            remoteJid: m.key.remoteJid,
            id: m.key.id,
            participant: m.key.participant
        }]);
    }

    use(fn) {
        this.middlewares.set(this.middlewares.size, fn);
    }

    async runMiddlewares(ctx, index = 0) {
        const middlewareFn = this.middlewares.get(index);
        if (!middlewareFn) return true;

        let nextCalled = false;
        let chainCompleted = false;

        await middlewareFn(ctx, async () => {
            nextCalled = true;
            chainCompleted = await this.runMiddlewares(ctx, index + 1);
        });

        return nextCalled && chainCompleted;
    }

    onMessage() {
        try {
            Object.assign(this.pushNames, JSON.parse(fs.readFileSync(this.pushnamesPath).toString()));
        } catch (error) {
            fs.writeFileSync(this.pushnamesPath, JSON.stringify(this.pushNames));
        }

        this.core.ev.on("messages.upsert", async (m) => {
            const [message] = messages;
            if (!message?.message) return;
            if (this.duplicateMessages.get(message.key.id)) return;

            const msgType = baileys.getContentType(message.message);
            const text = Functions.getContentFromMsg(message) ?? "";

            const m = {
                ...message,
                content: text || null,
                messageType: msgType
            };

            const senderJid = Functions.getSender(m, this.core);
            if (m.pushName && this.pushNames[senderJid] !== m.pushName) {
                this.pushNames[senderJid] = m.pushName;
                this.savePushnames();
            }

            const self = {
                ...this,
                getContentType: baileys.getContentType,
                downloadContentFromMessage: baileys.downloadContentFromMessage,
                proto: baileys.proto,
                Functions.cleanNullish(m)
            };

            const used = ExtractEventsContent(m, msgType);
            const ctx = new Ctx({
                used,
                args: [],
                self,
                client: this.core
            });

            if (MessageEventList[msgType]) await MessageEventList[msgType](m, this.ev, self, this.core);
            this.ev.emit(Events.MessagesUpsert, m, ctx);
            if (this.readIncomingMsg) await this.read(m);
            await require("../Handler/Commands.js")(self, this.runMiddlewares.bind(this));
        });
    }

    onGroupsJoin() {
        this.core.ev.on("groups.upsert", (m) => {
            this.ev.emit(Events.GroupsJoin, m);
        });
    }

    async setGroupCache(id) {
        if (!this.groupCache.get(id)) {
            const metadata = await this.core.groupMetadata(id);
            this.groupCache.set(id, metadata);
        }
    }

    onGroupsUpdate() {
        this.core.ev.on("groups.update", async ([m]) => {
            await this.setGroupCache(m.id);
        });
    }

    onGroupParticipantsUpdate() {
        this.core.ev.on("group-participants.update", async (m) => {
            await this.setGroupCache(m.id);

            if (m.action === "add") {
                return this.ev.emit(Events.UserJoin, m);
            } else if (m.action === "remove") {
                return this.ev.emit(Events.UserLeave, m);
            }
        });
    }

    onCall() {
        this.core.ev.on("call", (m) => {
            const withDecodedId = m.map(call => ({
                ...call,
                decodedFrom: Functions.decodeJid(call.from),
                decodedChatId: Functions.decodeJid(call.chatId)
            }));
            this.ev.emit(Events.Call, withDecodedId);
        });
    }

    command(opts, code) {
        if (typeof opts !== "string") return this.cmd.set(this.cmd.size, opts);

        if (!code) code = () => null;

        return this.cmd.set(this.cmd.size, {
            name: opts,
            code
        });
    }

    hears(query, callback) {
        this.hearsMap.set(this.hearsMap.size, {
            name: query,
            code: callback
        });
    }

    async groups() {
        return await this.core.groupFetchAllParticipating();
    }

    async bio(content) {
        await this.core.updateProfileStatus(content);
    }

    async fetchBio(jid) {
        const decodedJid = Functions.decodeJid(jid ? jid : this.core.user.id);
        return await this.core.fetchStatus(decodedJid);
    }

    decodeJid(jid) {
        return Functions.decodeJid(jid);
    }

    getPushname(jid) {
        return Functions.getPushname(jid, this.pushNames);
    }

    getId(jid) {
        return Functions.getId(jid);
    }

    async launch() {
        const {
            state,
            saveCreds
        } = await this.authAdapter;
        this.state = state;
        this.saveCreds = saveCreds;

        const version = this.WAVersion ? this.WAVersion : this.fallbackWAVersion;
        this.core = baileys.default({
            logger: this.logger,
            printQRInTerminal: this.printQRInTerminal,
            auth: this.state,
            browser: this.browser,
            version,
            qrTimeout: this.qrTimeout,
            markOnlineOnConnect: this.markOnlineOnConnect,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid)
        });

        if (this.usePairingCode && !this.core.authState.creds.registered) {
            this.consolefy.setTag("pairing-code");

            if (this.printQRInTerminal) {
                this.consolefy.error("If you are set the usePairingCode to true then you need to set printQRInTerminal to false.");
                this.consolefy.resetTag();
                return;
            }

            if (!this.phoneNumber) {
                this.consolefy.error("The phoneNumber options are required if you are using usePairingCode.");
                this.consolefy.resetTag();
                return;
            }

            this.phoneNumber = this.phoneNumber.replace(/[^0-9]/g, "");

            if (!this.phoneNumber.length) {
                this.consolefy.error("Invalid phoneNumber.");
                this.consolefy.resetTag();
                return;
            }

            if (!PHONENUMBER_MCC.some(mcc => this.phoneNumber.startsWith(mcc))) {
                this.consolefy.error("phoneNumber format must be like: 62xxx (starts with the country code).");
                this.consolefy.resetTag();
                return;
            }

            setTimeout(async () => {
                const code = this.customPairingCode ? await this.core.requestPairingCode(this.phoneNumber, this.customPairingCode) : await this.core.requestPairingCode(this.phoneNumber);

                this.consolefy.info(`Pairing Code: ${code}`);
                this.consolefy.resetTag();
            }, 3000);
        }

        this.onConnectionUpdate();
        this.onCredsUpdate();
        this.onMessage();
        this.onGroupsJoin();
        this.onGroupsUpdate();
        this.onGroupParticipantsUpdate();
        this.onCall();
    }
}

module.exports = Client;