module.exports = {
    Baileys: require("baileys"),
    Client: require("./Classes/Client.js"),
    CommandHandler: require("./Classes/CommandHandler.js"),
    Config: require("./Classes/Config.js"),
    Cooldown: require("./Classes/Cooldown.js"),
    VCardBuilder: require("./Classes/Builder/VCard.js"),
    Events: require("./Constant/Events.js"),
    MessageType: require("./Constant/MessageType.js"),
    Formatter: require("./Helper/Formatter.js"),
    Consolefy: require("@mengkodingan/consolefy").Consolefy,
    Gktw: {
        analyzeBug: require("safety-safe").analyzeMessage,
        didYouMean: require("didyoumean"),
        mime: require("mime-types")
    }
};