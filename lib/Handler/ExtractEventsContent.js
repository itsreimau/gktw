"use strict";

const MessageType = require("../Constant/MessageType.js");

function ExtractEventsContent(m, msgType) {
    const used = {
        upsert: m.content
    };

    const eventMapping = {
        [MessageType.pollCreationMessage]: (msg) => ({
            poll: msg.message.pollCreationMessage.name
        }),
        [MessageType.pollUpdateMessage]: (msg) => ({
            pollVote: msg.content
        }),
        [MessageType.reactionMessage]: (msg) => ({
            reactions: msg.content
        })
    };

    return eventMapping[msgType] ? {
        ...used,
        ...eventMapping[msgType](m)
    } : used;
}

module.exports = ExtractEventsContent;