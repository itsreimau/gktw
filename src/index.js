"use strict";

module.exports = {
    Baileys: {
        ...require("baileys"),
        G_US: "@g.us"
    },
    Client: require("./Classes/Client.js"),
    CommandHandler: require("./Classes/CommandHandler.js"),
    Cooldown: require("./Classes/Cooldown.js"),
    VCardBuilder: require("./Classes/Builder/VCard.js"),
    Events: require("./Constant/Events.js"),
    MessageType: require("./Constant/MessageType.js"),
    Formatter: require("./Helper/Formatter.js")
};