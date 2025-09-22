"use strict";

const { proto } = require("baileys");

const messageInstance = new proto.Message();
const MessageType = {};
for (const key in messageInstance) {
    if (messageInstance.hasOwnProperty(key) && typeof messageInstance[key] !== "function" && key !== "constructor") {
        MessageType[key] = key;
    }
}

module.exports = MessageType;