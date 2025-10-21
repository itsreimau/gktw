"use strict";

const Baileys = require("baileys");
const path = require("node:path");
const pino = require("pino");
const EventEmitter = require("node:events");
const { Consolefy } = require("@mengkodingan/consolefy");
const { NodeCache } = require("@cacheable/node-cache");
const Events = require("../Constant/Events.js");
const fs = require("node:fs");
const Functions = require("../Helper/Functions.js");
const Ctx = require("./Ctx.js");
const Commands = require("../Handler/Commands.js");
const SimplDB = require("simpl.db");

class Client {
    constructor(opts) {
        this.authDir = opts.authDir;
        this.browser = opts.browser ?? Baileys.Browsers.ubuntu("CHROME");
        this.WAVersion = opts.WAVersion;
        this.printQRInTerminal = opts.printQRInTerminal ?? true;
        this.qrTimeout = opts.qrTimeout ?? 60000;
        this.phoneNumber = opts.phoneNumber;
        this.usePairingCode = opts.usePairingCode ?? false;
        this.customPairingCode = opts.customPairingCode ?? false;
        this.logger = opts.logger ?? pino({
            level: "fatal"
        });
        this.useStore = opts.useStore ?? false;
        this.readIncomingMsg = opts.readIncomingMsg ?? false;
        this.markOnlineOnConnect = opts.markOnlineOnConnect ?? true;
        this.prefix = opts.prefix;
        this.selfReply = opts.selfReply ?? false;
        this.autoAiLabel = opts.autoAiLabel ?? false;
        this.databaseDir = opts.databaseDir;
        this.rawCitation = opts.citation ?? {};
        this.citation = {};

        this.fallbackWAVersion = [2, 3000, 1027934701];
        this.ev = new EventEmitter();
        this.cmd = new Map();
        this.cooldown = new Map();
        this.hearsMap = new Map();
        this.middlewares = new Map();
        this.consolefy = new Consolefy();
        this.store = Baileys.makeInMemoryStore({});
        this.storePath = path.resolve(this.authDir, "gktw_store.json");
        this.groupCache = new NodeCache({
            stdTTL: 30 * 60,
            useClones: false
        });
        this.messageIdCache = new NodeCache({
            stdTTL: 30,
            useClones: false
        });
        this.pushnamesPath = path.resolve(this.authDir, "pushnames.json");
        this.pushNames = {};
        this.db = new SimplDB({
            collectionsFolder: this.databaseDir
        });

        if (Array.isArray(this.prefix) && this.prefix.includes("")) this.prefix.sort((a, b) => a === "" ? 1 : b === "" ? -1 : 0);
        if (typeof this.prefix === "string") this.prefix = this.prefix.split("");
    }

    _savePushnames() {
        fs.writeFileSync(this.pushnamesPath, JSON.stringify(this.pushNames));
    }

    use(fn) {
        this.middlewares.set(this.middlewares.size, fn);
    }

    async _runMiddlewares(ctx, index = 0) {
        const middlewareFn = this.middlewares.get(index);
        if (!middlewareFn) return true;

        let nextCalled = false;
        await middlewareFn(ctx, async () => {
            if (nextCalled) throw new Error("next() called multiple times in middleware");
            nextCalled = true;
            return await this._runMiddlewares(ctx, index + 1);
        });

        return nextCalled;
    }

    async _setGroupCache(id) {
        if (!this.groupCache.get(id)) {
            const metadata = await this.core.groupMetadata(id);
            this.groupCache.set(id, metadata);
        }
    }

    async _registerCitation() {
        if (!Object.keys(this.rawCitation).length) return;

        const registeredCitation = {};
        for (const [citationName, citationIds] of Object.entries(this.rawCitation)) {
            if (!Array.isArray(citationIds)) {
                registeredCitation[citationName] = citationIds;
                continue;
            }

            const registeredIds = [];
            for (const citationId of citationIds) {
                if (citationId === "bot") {
                    registeredIds.push("bot");
                    continue;
                }

                const lidResult = await this.core.getLidUser(citationId + Baileys.S_WHATSAPP_NET);
                if (lidResult?.[0]?.lid) {
                    registeredIds.push(Functions.getId(lidResult[0].lid));
                    registeredIds.push(citationId);
                } else {
                    registeredIds.push(citationId);
                }
            }

            registeredCitation[citationName] = [...registeredIds];
        }

        this.citation = registeredCitation;
    }

    _loadPushNames() {
        try {
            this.pushNames = JSON.parse(fs.readFileSync(this.pushnamesPath, "utf8"));
        } catch {
            this._savePushnames();
        }
    }

    _onEvents() {
        this.core.ev.on("connection.update", async (update) => {
            this.ev.emit(Events.ConnectionUpdate, update);
            const {
                connection,
                lastDisconnect,
                qr
            } = update;

            if (qr) this.ev.emit(Events.QR, qr);

            if (connection === "close") {
                const shouldReconnect = lastDisconnect.error.output.statusCode !== Baileys.DisconnectReason.loggedOut;
                this.consolefy.error(`Connection closed: ${lastDisconnect.error}, reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) this.launch();
            } else if (connection === "open") {
                this.readyAt = Date.now();
                this.ev.emit(Events.ClientReady, this.core);
                await this._registerCitation();
            }
        });

        this.core.ev.on("creds.update", this.saveCreds);

        this._loadPushNames();

        this.core.ev.on("messages.upsert", async (event) => {
            for (const message of event.messages) {
                if (this.messageIdCache.get(message.key.id)) return;
                this.messageIdCache.set(message.key.id, true);

                if (Baileys.isJidGroup(message.key.remoteJid)) await this._setGroupCache(message.key.remoteJid);

                const messageType = Baileys.getContentType(message.message) ?? "";
                const text = Functions.getContentFromMsg(message) ?? "";
                const sender = Baileys.jidNormalizedUser(message.key.participant || message.key.remoteJid);

                if (message.pushName && this.pushNames[sender] !== message.pushName) {
                    this.pushNames[sender] = message.pushName;
                    this._savePushnames();
                }

                const msg = {
                    ...message,
                    content: text,
                    messageType
                };
                const self = {
                    ...this,
                    m: msg
                };
                const ctx = new Ctx({
                    used: {
                        upsert: text
                    },
                    args: [],
                    self,
                    client: this.core
                });

                this.ev.emit(Events.MessagesUpsert, msg, ctx);
                if (this.readIncomingMsg) await this.core.readMessages([message.key]);
                await Commands(self, this._runMiddlewares.bind(this));
            }
        });

        this.core.ev.on("groups.update", async ([event]) => {
            await this._setGroupCache(event.id);
        });

        this.core.ev.on("group-participants.update", async (event) => {
            await this._setGroupCache(event.id);
            this.ev.emit(event.action === "add" ? Events.UserJoin : Events.UserLeave, event);
        });

        this.core.ev.on("call", (event) => {
            this.ev.emit(Events.Call, event);
        });
    }

    command(opts, code) {
        if (typeof opts === "string") opts = {
            name: opts,
            code
        };
        if (!code) opts.code = () => null;
        this.cmd.set(this.cmd.size, opts);
    }

    hears(query, callback) {
        this.hearsMap.set(this.hearsMap.size, {
            name: query,
            code: callback
        });
    }

    checkCitation(msg, citationName) {
        if (!msg || !citationName || !this.citation[citationName]) return false;

        const citationIds = this.citation[citationName];
        if (!Array.isArray(citationIds)) return false;

        let senderJid, senderId, isFromBot, isFromBaileys;

        if (typeof msg === "string") {
            senderJid = Baileys.jidNormalizedUser(msg);
            senderId = Functions.getId(senderJid);
            isFromBot = false;
            isFromBaileys = false;
        } else {
            senderJid = Baileys.jidNormalizedUser(msg.key.participant || msg.key.remoteJid);
            senderId = Functions.getId(senderJid);
            isFromBot = msg.key.fromMe;
            isFromBaileys = msg.key.id && msg.key.id.startsWith("SUKI");
        }

        const botIds = [];
        if (this.core && this.core.user) {
            if (this.core.user.lid) botIds.push(Functions.getId(this.core.user.lid));
            if (this.core.user.id) botIds.push(Functions.getId(this.core.user.id));
        }

        return citationIds.some(citationId => {
            if (citationId === "bot") return isFromBot && !isFromBaileys && botIds.includes(senderId);
            if (botIds.includes(citationId)) return isFromBot && !isFromBaileys && botIds.includes(senderId);
            return citationId === senderId;
        });
    }

    getPushName(jid) {
        return Functions.getPushName(jid, this.pushNames);
    }

    getId(jid) {
        return Functions.getId(jid);
    }

    getDb(collection, jid) {
        return Functions.getDb(this.db.getCollection(collection) || this.db.createCollection(collection), jid);
    }

    async _fixUsersDb() {
        if (!this.core.authState.creds.registered) return;

        const users = this.db.getCollection("users") || this.db.createCollection("users");
        const altUsers = users.getMany(user => user.alt);
        const lidMap = new Map(users.getMany(user => !user.alt).map(user => [user.jid, user]));

        for (const altUser of altUsers) {
            if (!Baileys.isJidUser(altUser.alt)) return;

            const lidResult = await this.core.getLidUser(altUser.alt);
            if (!lidResult?.[0]) return;

            const lidJid = Baileys.jidNormalizedUser(lidResult[0].lid);
            let lidUser = lidMap.get(lidJid);

            if (lidUser) {
                Object.entries(altUser).forEach(([key, value]) => {
                    if (key === "alt" || key === "jid") return;
                    if (typeof value === "number" && typeof lidUser[key] === "number") {
                        lidUser[key] = Math.max(lidUser[key], value);
                    } else if (lidUser[key] === undefined) {
                        lidUser[key] = value;
                    }
                });
                users.update(user => Object.assign(user, lidUser), user => user.jid === lidJid);
            } else {
                const {
                    alt,
                    ...newUser
                } = {
                    ...altUser,
                    jid: lidJid
                };
                users.create(newUser);
                lidMap.set(lidJid, newUser);
            }
        }
    }

    async launch() {
        const {
            state,
            saveCreds
        } = await Baileys.useMultiFileAuthState(this.authDir);
        this.state = state;
        this.saveCreds = saveCreds;

        if (this.useStore) this._initStore();

        const version = this.WAVersion ?? this.fallbackWAVersion;
        this.core = Baileys.default({
            version,
            browser: this.browser,
            logger: this.logger,
            printQRInTerminal: this.printQRInTerminal,
            emitOwnEvents: this.selfReply,
            auth: this.state,
            markOnlineOnConnect: this.markOnlineOnConnect,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid),
            qrTimeout: this.qrTimeout
        });

        if (this.useStore) this.store.bind(this.core.ev);

        if (this.usePairingCode && !this.core.authState.creds.registered) await this._handlePairingCode();

        if (!fs.existsSync(this.databaseDir)) fs.mkdirSync(this.databaseDir, {
            recursive: true
        });

        setTimeout(() => this._fixUsersDb(), 10000);
        this._onEvents();
    }

    _initStore() {
        this.store.readFromFile(this.storePath);
        setInterval(() => this.store.writeToFile(this.storePath), 10000);

        this.store.cleanupMessages = (cutoff) => Object.keys(this.store.messages).forEach(jid => this.store.messages[jid] = this.store.messages[jid].filter((msg) => msg.messageTimestamp * 1000 > cutoff));

        setInterval(() => this.store.cleanupMessages(Date.now() - (7 * 24 * 60 * 60 * 1000)), 24 * 60 * 60 * 1000);
    }

    async _handlePairingCode() {
        this.consolefy.setTag("pairing-code");

        if (this.printQRInTerminal) {
            this.consolefy.error("printQRInTerminal must be false for usePairingCode");
            this.consolefy.resetTag();
            return;
        }

        if (!this.phoneNumber) {
            this.consolefy.error("phoneNumber is required for usePairingCode");
            this.consolefy.resetTag();
            return;
        }

        this.phoneNumber = this.phoneNumber.replace(/[^0-9]/g, "");
        if (!this.phoneNumber.length) {
            this.consolefy.error("Invalid phoneNumber");
            this.consolefy.resetTag();
            return;
        }

        if (!Object.keys(Baileys.PHONENUMBER_MCC).some(mcc => this.phoneNumber.startsWith(mcc))) {
            this.consolefy.error("phoneNumber format must be like: 62xxx (starts with country code)");
            this.consolefy.resetTag();
            return;
        }

        setTimeout(async () => {
            const code = this.customPairingCode ? await this.core.requestPairingCode(this.phoneNumber, this.customPairingCode) : await this.core.requestPairingCode(this.phoneNumber);
            this.consolefy.info(`Pairing Code: ${code}`);
            this.consolefy.resetTag();
        }, 3000);
    }
}

module.exports = Client;