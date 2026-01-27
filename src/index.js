const Baileys = require("baileys");
const Client = require("./Classes/Client.js");
const CommandHandler = require("./Classes/CommandHandler.js");
const Config = require("./Classes/Config.js");
const Cooldown = require("./Classes/Cooldown.js");
const VCardBuilder = require("./Classes/Builder/VCard.js");
const Events = require("./Constant/Events.js");
const MessageType = require("./Constant/MessageType.js");
const Formatter = require("./Helper/Formatter.js");
const { Consolefy } = require("@mengkodingan/consolefy");
const { analyzeMessage } = require("guaranteed_security");
const didYouMean = require("didyoumean");
const mime = require("mime-types");

module.exports = {
    Baileys,
    Client,
    CommandHandler,
    Config,
    Cooldown,
    VCardBuilder,
    Events,
    MessageType,
    Formatter,
    Consolefy,
    Gktw: {
        analyzeBug: analyzeMessage,
        didYouMean,
        mime
    }
};