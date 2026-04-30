const Baileys = require("baileys");
const EventEmitter = require("node:events");
const { Consolefy } = require("@mengkodingan/consolefy");
const pino = require("pino");
const path = require("node:path");
const { NodeCache } = require("@cacheable/node-cache");
const SimplDB = require("simpl.db");
const Functions = require("../Helper/Functions.js");
const Events = require("../Constant/Events.js");
const qrcode = require("qrcode-terminal");
const Ctx = require("./Ctx.js");
const Commands = require("../Handler/Commands.js");
const fs = require("node:fs");

class Client {
    constructor(opts) {
        const authOpts = opts.auth || {};
        this.authAdapter = authOpts.adapter || "multi";
        this.authDir = authOpts.dir || (this.authAdapter === "single" ? "./state.json" : "./state");
        this.phoneNumber = authOpts.phoneNumber || null;
        this.usePairingCode = authOpts.usePairingCode || false;
        this.customPairingCode = authOpts.customPairingCode || null;
        this.useStore = authOpts.useStore || false;

        const connectionOpts = opts.connection || {};
        this.suppressBaileys = connectionOpts.suppressBaileys || true;
        this.browser = connectionOpts.browser || Baileys.Browsers.macOS("Safari");
        this.WAVersion = connectionOpts.version || null;
        this.alwaysOnline = connectionOpts.alwaysOnline || false;
        this.selfReply = connectionOpts.selfReply || false;
        this.loggerLevel = connectionOpts.loggerLevel || "silent";

        const messagingOpts = opts.messaging || {};
        this.autoRead = messagingOpts.autoRead || false;
        this.prefix = messagingOpts.prefix || /^[°•π÷×¶∆£¢€¥®™+✓_=|/~!?@#%^&.©^]/i;

        const databaseOpts = opts.database || {};
        this.databaseDir = databaseOpts.dir || "./database";

        this.owner = opts.owner || [];

        this.ev = new EventEmitter();
        this.cmd = new Map();
        this.cooldown = new Map();
        this.hearsMap = new Map();
        this.middlewares = new Map();
        this.consolefy = new Consolefy();
        this.logger = pino({
            level: this.loggerLevel
        });
        this.store = Baileys.makeInMemoryStore({});
        this.storePath = path.resolve(this.authDir, "store.json");
        this.groupCache = new NodeCache({
            stdTTL: 30 * 60,
            useClones: false
        });
        this.messageIdCache = new NodeCache({
            stdTTL: 10,
            useClones: false
        });
        this.db = new SimplDB({
            collectionsFolder: this.databaseDir,
            tabSize: 2
        });

        if (Array.isArray(this.prefix) && this.prefix.includes("")) this.prefix.sort((a, b) => a === "" ? 1 : b === "" ? -1 : 0);
        if (typeof this.prefix === "string") this.prefix = this.prefix.split("");
        if (!this.db.getCollection("bot")) this.db.createCollection("bot");
        if (!this.db.getCollection("users")) this.db.createCollection("users");
        if (!this.db.getCollection("groups")) this.db.createCollection("groups");
    }

    async _setAllGroupCache() {
        const allGroups = await this.core.groupFetchAllParticipating();
        for (const [id, metadata] of Object.entries(allGroups)) {
            this.groupCache.set(id, metadata);
        }
    }

    _shouldIgnore(messageId, body) {
        if (this.messageIdCache.get(messageId)) return true;
        this.messageIdCache.set(messageId, true);
        return false;
    }

    _updatePushNameDb(jid, pushName) {
        const users = this.db.getCollection("users");
        const userDb = Functions.getDb(users, jid);
        if (userDb?.pushName !== pushName) userDb.pushName = pushName;
        userDb.save();
    }

    async _setGroupCache(id) {
        const metadata = await this.core.groupMetadata(id);
        this.groupCache.set(id, metadata);
    }

    _onEvents() {
        this.core.ev.on("connection.update", async (update) => {
            const {
                qr,
                connection,
                lastDisconnect
            } = update;

            if (qr && !this.usePairingCode)
                qrcode.generate(qr, {
                    small: true
                });

            if (connection === "close") {
                const shouldReconnect = lastDisconnect.error.output?.statusCode !== Baileys.DisconnectReason.loggedOut;
                this.consolefy.error(`Connection closed: ${lastDisconnect.error}, reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) await this.launch();
            } else if (connection === "open") {
                this.readyAt = Date.now();
                this.ev.emit(Events.ClientReady, this.core);
                await Baileys.delay(3000);
                await this._setAllGroupCache();
            }
        });

        this.core.ev.on("creds.update", this.saveCreds);

        this.core.ev.on("messages.upsert", async (event) => {
            if (event.type === "append") return;

            for (const message of event.messages) {
                if (message.key.fromMe && message.key.id.includes("STARFALL")) continue;
                if (this._shouldIgnore(message.key.id)) continue;

                const senderJids = [message.key.participant, message.key.participantAlt, message.key.remoteJid, message.key.remoteJidAlt];
                const senderJid = message.key.fromMe ? this.core.user.id : senderJids.find(jid => Baileys.isPnUser(jid));
                const senderLid = message.key.fromMe ? this.core.user.lid : senderJids.find(jid => Baileys.isLidUser(jid));

                if (!senderJid || !senderLid || !message.pushName) continue;

                this._updatePushNameDb(senderLid, message.pushName);

                const body = Functions.geBodyFromMsg(message);
                const self = {
                    ...this,
                    sender: {
                        jid: senderJid,
                        lid: senderLid,
                        pushName: message.pushName
                    },
                    m: {
                        ...message,
                        body
                    }
                };
                const ctx = new Ctx({
                    used: {
                        upsert: body
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

            const action = event.action;
            if (!["add", "leave", "remove"].includes(action)) return;
            delete event.action;
            for (const participant of event.participants) {
                delete event.participants;
                this.ev.emit(action === "add" ? Events.UserJoin : Events.UserLeave, {
                    ...event,
                    participant: participant.id,
                    participantPn: participant.phoneNumber
                });
            }
        });

        this.core.ev.on("call", (calls) => {
            for (const call of calls) {
                this.ev.emit(Events.Call, call);
            }
        });
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

    command(opts, code) {
        if (typeof opts === "string")
            opts = {
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

    checkOwner(jid = Baileys.PSA_WID, fromMe = false) {
        return Functions.checkOwner(jid, this.owner, fromMe);
    }

    getPushName(jid = Baileys.PSA_WID) {
        return Functions.getPushName(jid, this.db);
    }

    getId(jid = Baileys.PSA_WID) {
        return Functions.getId(jid);
    }

    getDb(collection, jid = Baileys.PSA_WID) {
        const coll = this.db.getCollection(collection);
        return Functions.getDb(coll, jid);
    }

    async launch() {
        if (this.suppressBaileys) require("@itsreimau/suppress-baileys");

        const {
            state,
            saveCreds
        } = await Baileys[this.authAdapter === "single" ? "useSingleFileAuthState" : "useMultiFileAuthState"](this.authDir);
        this.state = state;
        this.saveCreds = saveCreds;

        if (this.useStore) {
            this.store.readFromFile(this.storePath);
            setInterval(() => this.store.writeToFile(this.storePath), 10000);

            this.store.cleanupMessages = (cutoff) => {
                for (const jid of Object.keys(this.store.messages)) {
                    this.store.messages[jid] = this.store.messages[jid].filter(message => message.messageTimestamp * 1000 > cutoff);
                }
            };

            setInterval(() => this.store.cleanupMessages(Date.now() - (7 * 24 * 60 * 60 * 1000)), 24 * 60 * 60 * 1000);
        }

        this.core = Baileys.default({
            ...(this.WAVersion ? {
                version: this.WAVersion
            } : {}),
            browser: this.browser,
            logger: this.logger,
            emitOwnEvents: this.selfReply,
            auth: this.state,
            markOnlineOnConnect: this.alwaysOnline,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid)
        });

        if (this.useStore) this.store.bind(this.core.ev);

        if (this.usePairingCode && !this.core.authState.creds.registered) {
            this.consolefy.setTag("pairing-code");

            if (!this.phoneNumber) {
                this.consolefy.error("phoneNumber options are required if you are using usePairingCode.");
                this.consolefy.resetTag();
                return;
            }

            this.phoneNumber = this.phoneNumber.replace(/[^0-9]/g, "");
            if (!this.phoneNumber.length) {
                this.consolefy.error("Invalid phoneNumber");
                this.consolefy.resetTag();
                return;
            }

            await Baileys.delay(3000);
            const code = await this.core.requestPairingCode(this.phoneNumber, this.customPairingCode);
            this.consolefy.info(`Pairing Code: ${code}`);
            this.consolefy.resetTag();
        }

        if (this.useStore) this.store.bind(this.core.ev);

        if (!fs.existsSync(this.databaseDir))
            fs.mkdirSync(this.databaseDir, {
                recursive: true
            });

        this._onEvents();

        this.sendMessage = (jid, content, options = {}) => {
            if (content?.album && Array.isArray(content.album)) {
                if (content.album.length === 1) {
                    const {
                        album,
                        ...rest
                    } = content;
                    content = {
                        ...content.album[0],
                        ...rest
                    };
                } else {
                    const album = [...content.album];
                    if (album.every(a => !a.caption) && content.caption) album[0].caption = content.caption;
                    content = {
                        album
                    };
                }
            }
            content = typeof content === "string" ? {
                text: content
            } : content;
            if (Baileys.isPnUser(jid) || Baileys.isLidUser(jid)) content.ai = true;
            return this.core.sendMessage(jid, content, options);
        };
    }
}

module.exports = Client;