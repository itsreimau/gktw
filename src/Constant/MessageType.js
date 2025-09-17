"use strict";

const { proto } = require("baileys");

const MessageType = {};
for (const key in proto.Message) {
    if (proto.Message.hasOwnProperty(key)) {
        MessageType[key] = key;
    }
}

module.exports = MessageType;