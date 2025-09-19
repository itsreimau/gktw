"use strict";

const MessageType = require("../Constant/MessageType.js");

function extractEventsContent(message, messageType) {
    const used = {
        upsert: message.content
    };
    const eventMapping = new Map([
        [MessageType.pollCreationMessage, (msg) => ({
            poll: msg.message?.pollCreationMessage?.name
        })],
        [MessageType.pollUpdateMessage, (msg) => ({
            pollVote: msg.content
        })],
        [MessageType.reactionMessage, (msg) => ({
            reactions: msg.content
        })]
    ]);
    const handler = eventMapping.get(messageType);
    return handler ? {
        ...used,
        ...handler(message)
    } : used;
}

module.exports = extractEventsContent;