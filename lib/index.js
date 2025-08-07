"use strict";

const Baileys = require("baileys");

module.exports = {
    Browsers: Baileys.Browsers,
    fetchLatestWaWebVersion: Baileys.fetchLatestWaWebVersion,
    Client: require("./Classes/Client.js"),
    CommandHandler: require("./Classes/CommandHandler.js"),
    Cooldown: require("./Classes/Cooldown.js"),
    VCardBuilder: require("./Classes/Builder/VCard.js"),
    Events: require("./Constant/Events.js"),
    MessageType: require("./Constant/MessageType.js"),
    Formatter: require("./Helper/Formatter.js")
};