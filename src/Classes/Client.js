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
        this.authDir = opts.authDir ?? null;
        this.browser = opts.browser ?? Baileys.Browsers.ubuntu("Chrome");
        this.WAVersion = opts.WAVersion ?? null;
        this.phoneNumber = opts.phoneNumber ?? null;
        this.usePairingCode = opts.usePairingCode ?? false;
        this.customPairingCode = opts.customPairingCode ?? false;
        this.useStore = opts.useStore ?? false;
        this.autoRead = opts.autoRead ?? false;
        this.alwaysOnline = opts.alwaysOnline ?? true;
        this.selfReply = opts.selfReply ?? false;
        this.databaseDir = opts.databaseDir ?? null;
        this.owner = opts.owner ?? [];

        this.ev = new EventEmitter();
        this.cmd = new Map();
        this.cooldown = new Map();
        this.hearsMap = new Map();
        this.middlewares = new Map();
        this.consolefy = new Consolefy();
        this.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|/~!?@#%^&.©^]/i;
        this.logger = pino({
            level: "fatal"
        });
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

    async _registerOwner() {
        if (!Array.isArray(this.owner) || !this.owner.length) return;

        const registeredOwner = [];
        for (const ownerId of this.owner) {
            if (ownerId === "bot") {
                registeredOwner.push("bot");
                continue;
            }

            const ownerJid = ownerId + Baileys.S_WHATSAPP_NET;
            const ownerLid = await Functions.getLidUser(ownerJid, this.core.onWhatsApp);
            registeredOwner.push(ownerJid);
            if (ownerLid) registeredOwner.push(Baileys.jidNormalizedUser(ownerLid));
        }

        this.owner = registeredOwner;
    }

    async _fixUsersDb() {
        if (!this.core.authState.creds.registered) return;

        const users = this.db.getCollection("users") || this.db.createCollection("users");
        const altUsers = users.getMany(user => user.alt);
        if (!altUsers.length) return;

        const primaryMap = new Map(users.getMany(user => !user.alt).map(user => [user.jid, user]));

        for (const altUser of altUsers) {
            if (!Baileys.isJidUser(altUser.alt)) continue;

            const userLid = await Functions.getLidUser(altUser.alt, this.core.onWhatsApp);
            if (!userLid) continue;

            const lidJid = Baileys.jidNormalizedUser(userLid);
            const primaryUser = primaryMap.get(lidJid);

            if (primaryUser) {
                for (const [key, value] of Object.entries(altUser)) {
                    if (key === "alt" || key === "jid") continue;
                    if (typeof value === "number" && typeof primaryUser[key] === "number") {
                        primaryUser[key] = Math.max(primaryUser[key], value);
                    } else if (primaryUser[key] === undefined) {
                        primaryUser[key] = value;
                    }
                }
                users.update(user => Object.assign(user, primaryUser), user => user.jid === lidJid);
            } else {
                const {
                    alt,
                    ...newUser
                } = {
                    ...altUser,
                    jid: lidJid
                };
                users.create(newUser);
                primaryMap.set(lidJid, newUser);
            }
        }
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
            const {
                connection,
                lastDisconnect
            } = update;

            if (connection === "close") {
                const shouldReconnect = lastDisconnect.error.output?.statusCode !== Baileys.DisconnectReason.loggedOut;
                this.consolefy.error(`Connection closed: ${lastDisconnect.error}, reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) this.launch();
            } else if (connection === "open") {
                this.readyAt = Date.now();
                this.ev.emit(Events.ClientReady, this.core);
                await this._registerOwner();
                setTimeout(() => this._fixUsersDb(), 10000);
            }
        });

        this.core.ev.on("creds.update", this.saveCreds);
        this._loadPushNames();

        this.core.ev.on("messages.upsert", async (event) => {
            for (const message of event.messages) {
                if (this.messageIdCache.get(message.key.id)) return;
                this.messageIdCache.set(message.key.id, true);

                if (Baileys.isJidGroup(message.key.remoteJid)) await this._setGroupCache(message.key.remoteJid);

                const sender = Baileys.jidNormalizedUser(message.key.participant || message.key.remoteJid);
                if (message.pushName && this.pushNames[sender] !== message.pushName) {
                    this.pushNames[sender] = message.pushName;
                    this._savePushnames();
                }

                const text = Functions.getTextFromMsg(message) ?? "";
                const self = {
                    ...this,
                    m: {
                        ...message,
                        text
                    }
                };
                const ctx = new Ctx({
                    used: {
                        upsert: text
                    },
                    args: [],
                    self,
                    client: this.core
                });

                this.ev.emit(Events.MessagesUpsert, ctx);
                if (this.autoRead) await this.core.readMessages([message.key]);
                await Commands(self, this._runMiddlewares.bind(this));
            }
        });

        this.core.ev.on("groups.update", async ([event]) => {
            await this._setGroupCache(event.id);
        });

        this.core.ev.on("group-participants.update", async (event) => {
            await this._setGroupCache(event.id);
            for (const participant of event.participants) {
                const ctx = {
                    id: event.id,
                    participant
                };
                this.ev.emit(event.action === "add" ? Events.UserJoin : Events.UserLeave, ctx);
            }
        });

        this.core.ev.on("call", (events) => {
            for (const ctx of events) {
                this.ev.emit(Events.Call, ctx);
            }
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

    checkOwner(key) {
        return Functions.checkOwner(key, this.owner, Baileys.jidNormalizedUser(this.core.user.id));
    }

    getPushName(jid) {
        return Functions.getPushName(jid, this.pushNames);
    }

    getId(jid) {
        return Baileys.jidDecode(jid)?.user || jid;
    }

    async getLidUser(jid) {
        return await Functions.getLidUser(jid, this.core.onWhatsApp);
    }

    getDb(collection, jid) {
        const coll = this.db.getCollection(collection) || this.db.createCollection(collection);
        return Functions.getDb(coll, jid);
    }

    async launch() {
        const {
            state,
            saveCreds
        } = await Baileys.useMultiFileAuthState(this.authDir);
        this.state = state;
        this.saveCreds = saveCreds;

        if (this.useStore) this._initStore();

        this.core = Baileys.default({
            ...(this.WAVersion ? {
                version: this.WAVersion
            } : {}),
            browser: this.browser,
            logger: this.logger,
            printQRInTerminal: !this.usePairingCode,
            emitOwnEvents: this.selfReply,
            auth: this.state,
            markOnlineOnConnect: this.alwaysOnline,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid)
        });

        if (this.useStore) this.store.bind(this.core.ev);

        if (this.usePairingCode && !this.core.authState.creds.registered) await this._handlePairingCode();

        if (!fs.existsSync(this.databaseDir)) fs.mkdirSync(this.databaseDir, {
            recursive: true
        });

        this._onEvents();
    }

    _initStore() {
        this.store.readFromFile(this.storePath);
        setInterval(() => this.store.writeToFile(this.storePath), 10000);

        this.store.cleanupMessages = (cutoff) => {
            for (const jid of Object.keys(this.store.messages)) {
                this.store.messages[jid] = this.store.messages[jid].filter(msg => msg.messageTimestamp * 1000 > cutoff);
            }
        };

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

        const PHONENUMBER_MCC = await (await fetch("https://raw.githubusercontent.com/Itsukichann/Baileys/refs/heads/master/lib/Defaults/phonenumber-mcc.json")).json();
        if (!Object.keys(PHONENUMBER_MCC).some(mcc => this.phoneNumber.startsWith(mcc))) {
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