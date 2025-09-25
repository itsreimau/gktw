"use strict";

const Baileys = require("baileys");
const { analyzeMessage } = require("safety-safe");
const didYouMean = require("didyoumean");
const mime = require("mime-types");
const { tmpfiles } = require("@neoxr/helper");
const Client = require("./Classes/Client.js");
const CommandHandler = require("./Classes/CommandHandler.js");
const Cooldown = require("./Classes/Cooldown.js");
const VCardBuilder = require("./Classes/Builder/VCard.js");
const Events = require("./Constant/Events.js");
const MessageType = require("./Constant/MessageType.js");
const Formatter = require("./Helper/Formatter.js");

const ANOTHER_UTILS = {
    analyzeBug: analyzeMessage,
    didYouMean,
    mime,
    uploadFile: tmpfiles,
    OFFICIAL_BIZ_JID: Baileys.jidNormalizedUser(Baileys.OFFICIAL_BIZ_JID),
    META_AI_JID: Baileys.jidNormalizedUser(Baileys.META_AI_JID),
    G_US: "@g.us",
    LID: "@lid"
};

module.exports = {
    Baileys: {
        ...Baileys,
        ...ANOTHER_UTILS
    },
    Client,
    CommandHandler,
    Cooldown,
    VCardBuilder,
    Events,
    MessageType,
    Formatter
};