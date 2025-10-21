"use strict";

const Baileys = require("baileys");
const Client = require("./Classes/Client.js");
const CommandHandler = require("./Classes/CommandHandler.js");
const Cooldown = require("./Classes/Cooldown.js");
const VCardBuilder = require("./Classes/Builder/VCard.js");
const Events = require("./Constant/Events.js");
const MessageType = require("./Constant/MessageType.js");
const Formatter = require("./Helper/Formatter.js");
const { Consolefy } = require("@mengkodingan/consolefy");
const { analyzeMessage } = require("safety-safe");
const didYouMean = require("didyoumean");
const mime = require("mime-types");
const { tmpfiles } = require("@neoxr/helper");

module.exports = {
    Baileys,
    Client,
    CommandHandler,
    Cooldown,
    VCardBuilder,
    Events,
    MessageType,
    Formatter,
    Consolefy,
    Gktw: {
        analyzeBug: analyzeMessage,
        didYouMean,
        mime,
        uploadFile: tmpfiles,
        G_US: "@g.us",
        LID: "@lid",
        WHATSAPP_JID: "0@s.whatsapp.net",
        META_JID: "13135550002@s.whatsapp.net",
        CHATGPT_JID: "18002428478@s.whatsapp.net",
        COPILOT_JID: "18772241042@s.whatsapp.net",
        INSTAGRAM_JID: "447723442971@s.whatsapp.net",
        TIKTOK_JID: "6285574670498@s.whatsapp.net"
    }
};