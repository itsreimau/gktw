"use strict";

const Baileys = require("baileys");
const pino = require("pino");
const EventEmitter = require("node:events");
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
const {
    parsePhoneNumberFromString
} = require("libphonenumber-js");

class Client {
    constructor(opts) {
        this.authDir = opts.authDir ?? "./state";
        this.authAdapter = opts.authAdapter ?? Baileys.useMultiFileAuthState(this.authDir);
        this.WAVersion = opts.WAVersion;
        this.browser = opts.browser ?? Baileys.Browsers.ubuntu("CHROME");
        this.printQRInTerminal = opts.printQRInTerminal ?? true;
        this.phoneNumber = opts.phoneNumber;
        this.usePairingCode = opts.usePairingCode ?? false;
        this.customPairingCode = opts.customPairingCode ?? false;
        this.qrTimeout = opts.qrTimeout ?? 60000;
        this.logger = opts.logger ?? pino({
            level: "fatal"
        });
        this.useStore = opts.useStore ?? false;
        this.readIncomingMsg = opts.readIncomingMsg ?? false;
        this.markOnlineOnConnect = opts.markOnlineOnConnect ?? true;
        this.prefix = opts.prefix;
        this.selfReply = opts.selfReply ?? false;
        this.autoMention = opts.autoMention ?? false;
        this.autoAiLabel = opts.autoAiLabel ?? false;
        this.fallbackWAVersion = [2, 3000, 1021387508];

        this.ev = new EventEmitter();
        this.cmd = new Collection();
        this.cooldown = new Collection();
        this.hearsMap = new Collection();
        this.middlewares = new Collection();
        this.consolefy = new Consolefy();
        this.store = Baileys.makeInMemoryStore({});
        this.storePath = `${this.authDir}/gktw_store.json`;
        this.groupCache = new NodeCache({
            stdTTL: 5 * 60,
            useClones: false
        });
        this.messageIdCache = new NodeCache({
            stdTTL: 30,
            useClones: false
        });
        this.pushnamesPath = `${this.authDir}/pushnames.json`;
        this.pushNames = {};

        if (typeof this.prefix === "string") this.prefix = this.prefix.split("");
    }

    onConnectionUpdate() {
        this.core.ev.on("connection.update", (m) => {
            this.ev.emit(Events.ConnectionUpdate, m);
            const {
                connection,
                lastDisconnect
            } = m;

            if (m.qr) this.ev.emit(Events.QR, m.qr);

            if (connection === "close") {
                const shouldReconnect = lastDisconnect.error.output.statusCode !== Baileys.DisconnectReason.loggedOut;
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
        let middlewareCompleted = false;

        await middlewareFn(ctx, async () => {
            if (nextCalled) throw new Error("next() called multiple times in middleware");
            nextCalled = true;
            middlewareCompleted = await this.runMiddlewares(ctx, index + 1);
        });

        if (!nextCalled && !middlewareCompleted) return false;

        return middlewareCompleted;
    }

    onMessage() {
        try {
            Object.assign(this.pushNames, JSON.parse(fs.readFileSync(this.pushnamesPath).toString()));
        } catch (error) {
            fs.writeFileSync(this.pushnamesPath, JSON.stringify(this.pushNames));
        }

        this.core.ev.on("messages.upsert", async (m) => {
            const [message] = m.messages;
            if (!message?.message) return;

            if (this.messageIdCache.get(message.key.id)) return;
            this.messageIdCache.set(message.key.id, true);

            const messageType = Baileys.getContentType(message.message);
            const text = Functions.getContentFromMsg(message) ?? "";

            const msg = {
                content: text,
                ...message,
                messageType
            };

            if (msg.key.remoteJid?.endsWith("@g.us")) await this.setGroupCache(msg.key.remoteJid);

            const senderJid = await Functions.getSender(msg, this.core);
            if (msg.pushName && this.pushNames[senderJid] !== msg.pushName) {
                this.pushNames[senderJid] = msg.pushName;
                this.savePushnames();
            }

            const self = {
                ...this,
                m: msg
            };

            const used = ExtractEventsContent(msg, messageType);
            const ctx = new Ctx({
                used,
                args: [],
                self,
                client: this.core
            });

            if (MessageEventList[messageType]) await MessageEventList[messageType](msg, this.ev, self, this.core);
            this.ev.emit(Events.MessagesUpsert, msg, ctx);
            if (this.readIncomingMsg) await this.read(msg);
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

        if (this.useStore) {
            this.store.readFromFile(this.storePath);
            setInterval(() => {
                this.store.writeToFile(this.storePath);
            }, 10_000)
        }

        const version = this.WAVersion ? this.WAVersion : this.fallbackWAVersion;
        this.core = Baileys.default({
            logger: this.logger,
            printQRInTerminal: this.printQRInTerminal,
            auth: this.state,
            browser: this.browser,
            version,
            qrTimeout: this.qrTimeout,
            markOnlineOnConnect: this.markOnlineOnConnect,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid)
        });

        if (this.useStore) this.store.bind(this.core.ev);

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

            const phoneNumber = parsePhoneNumberFromString(`+${this.phoneNumber}`);
            if (!phoneNumber || !phoneNumber.isValid()) {
                this.consolefy.error("phoneNumber format must be valid (e.g. '62xxx' starting with country code).");
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