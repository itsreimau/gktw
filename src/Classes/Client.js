"use strict";

const Baileys = require("baileys");
const path = require("node:path");
const pino = require("pino");
const EventEmitter = require("node:events");
const { Collection } = require("@discordjs/collection");
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

        this.fallbackWAVersion = [2, 3000, 1021387508];
        this.ev = new EventEmitter();
        this.cmd = new Collection();
        this.cooldown = new Collection();
        this.hearsMap = new Collection();
        this.middlewares = new Collection();
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

        if (Array.isArray(this.prefix) && this.prefix.includes("")) this.prefix.sort((a, b) => a === "" ? 1 : b === "" ? -1 : 0);
        if (typeof this.prefix === "string") this.prefix = this.prefix.split("");
    }

    savePushnames() {
        fs.writeFileSync(this.pushnamesPath, JSON.stringify(this.pushNames));
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

    use(fn) {
        this.middlewares.set(this.middlewares.size, fn);
    }

    async setGroupCache(id) {
        if (!this.groupCache.get(id)) {
            const metadata = await this.core.groupMetadata(id);
            this.groupCache.set(id, metadata);
        }
    }

    onEvents() {
        this.core.ev.on("connection.update", (update) => {
            this.ev.emit(Events.ConnectionUpdate, update);
            const {
                connection,
                lastDisconnect
            } = update;

            if (update.qr) this.ev.emit(Events.QR, update.qr);

            if (connection === "close") {
                const shouldReconnect = lastDisconnect.error.output.statusCode !== Baileys.DisconnectReason.loggedOut;
                this.consolefy.error(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
                if (shouldReconnect) this.launch();
            } else if (connection === "open") {
                this.readyAt = Date.now();
                this.ev.emit(Events.ClientReady, this.core);
            }
        });

        this.core.ev.on("creds.update", this.saveCreds);

        try {
            Object.assign(this.pushNames, JSON.parse(fs.readFileSync(this.pushnamesPath).toString()));
        } catch (error) {
            fs.writeFileSync(this.pushnamesPath, JSON.stringify(this.pushNames));
        }

        this.core.ev.on("messages.upsert", async (event) => {
            for (const message of event.messages) {
                if (this.messageIdCache.get(message.key.id)) return;
                this.messageIdCache.set(message.key.id, true);

                if (Baileys.isJidGroup(message.key.remoteJid)) await this.setGroupCache(message.key.remoteJid);

                const messageType = Baileys.getContentType(message.message) ?? "";
                const text = Functions.getContentFromMsg(message) ?? "";
                const sender = Functions.getSender(message, this.core);

                if (message.pushName && this.pushNames[sender] !== message.pushName) {
                    this.pushNames[sender] = message.pushName;
                    this.savePushnames();
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
                        upsert: message.content
                    },
                    args: [],
                    self,
                    client: this.core
                });

                this.ev.emit(Events.MessagesUpsert, msg, ctx);
                if (this.readIncomingMsg) await this.core.readMessages([message.key]);
                await Commands(self, this.runMiddlewares.bind(this));
            }
        });

        this.core.ev.on("groups.update", async ([event]) => {
            await this.setGroupCache(event.id);
        });

        this.core.ev.on("group-participants.update", async (event) => {
            await this.setGroupCache(event.id);

            if (event.action === "add") {
                return this.ev.emit(Events.UserJoin, event);
            } else if (event.action === "remove") {
                return this.ev.emit(Events.UserLeave, event);
            }
        });

        this.core.ev.on("call", (event) => {
            this.ev.emit(Events.Call, event);
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

    decodeJid(jid) {
        return Baileys.jidNormalizedUser(jid);
    }

    getPushname(jid) {
        return Functions.getPushname(jid, false, this.pushNames);
    }

    getId(jid) {
        return Functions.getId(jid);
    }

    db() {
        return new SimplDB();
    }

    async launch() {
        const {
            state,
            saveCreds
        } = await Baileys.useMultiFileAuthState(this.authDir);
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
            version,
            browser: this.browser,
            logger: this.logger,
            printQRInTerminal: this.printQRInTerminal,
            emitOwnEvents: this.selfReply,
            auth: this.state,
            markOnlineOnConnect: this.markOnlineOnConnect,
            shouldSyncHistoryMessage: (msg) => {
                const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
                return msg.messageTimestamp * 1000 > twoDaysAgo;
            },
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid),
            qrTimeout: this.qrTimeout,
            msgRetryCounterCache: new NodeCache({
                stdTTL: 300,
                checkperiod: 60
            })
        });

        if (this.useStore) {
            this.store.bind(this.core.ev);

            this.store.cleanupMessages = (cutoff) => {
                Object.keys(this.store.messages).forEach((jid) => {
                    this.store.messages[jid] = this.store.messages[jid].filter(
                        (msg) => msg.messageTimestamp * 1000 > cutoff
                    );
                });
            };

            setInterval(() => {
                const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
                this.store.cleanupMessages(cutoff);
            }, 24 * 60 * 60 * 1000)
        }

        if (this.usePairingCode && !this.core.authState.creds.registered) {
            this.consolefy.setTag("pairing-code");

            if (this.printQRInTerminal) {
                this.consolefy.error("If you are set usePairingCode to true then you need to set printQRInTerminal to false.");
                this.consolefy.resetTag();
                return;
            }

            if (!this.phoneNumber) {
                this.consolefy.error("phoneNumber options are required if you are using usePairingCode.");
                this.consolefy.resetTag();
                return;
            }

            this.phoneNumber = this.phoneNumber.replace(/[^0-9]/g, "");

            if (!this.phoneNumber.length) {
                this.consolefy.error("Invalid phoneNumber.");
                this.consolefy.resetTag();
                return;
            }

            if (!Object.keys(Baileys.PHONENUMBER_MCC).some(mcc => this.phoneNumber.startsWith(mcc))) {
                this.consolefy.error("phoneNumber format must be like: 62xxx (starts with country code).");
                this.consolefy.resetTag();
                return;
            }

            setTimeout(async () => {
                const code = this.customPairingCode ? await this.core.requestPairingCode(this.phoneNumber, this.customPairingCode) : await this.core.requestPairingCode(this.phoneNumber);
                this.consolefy.info(`Pairing Code: ${code}`);
                this.consolefy.resetTag();
            }, 3000);
        }

        this.onEvents();
    }
}

module.exports = Client;