"use strict";

const ExtractEventsContent = require("./ExtractEventsContent.js");
const MessageType = require("../Constant/MessageType.js");
const Events = require("../Constant/Events.js");
const Ctx = require("../Classes/Ctx.js");

async function emitPollCreation(m, ev, self, core) {
    const used = ExtractEventsContent(m, MessageType.pollCreationMessage);
    m.pollValues = m.message.pollCreationMessage.options.map(msg => msg.optionName);
    m.pollSingleSelect = Boolean(m.message.pollCreationMessage.selectableOptionsCount);
    ev.emit(Events.Poll, m, new Ctx({
        used,
        args: [],
        self,
        client: core
    }));
}

async function emitPollUpdate(m, ev, self, core) {
    const used = ExtractEventsContent(m, MessageType.pollUpdateMessage);
    ev.emit(Events.PollVote, m, new Ctx({
        used,
        args: [],
        self,
        client: core
    }));
}

async function emitReaction(m, ev, self, core) {
    const used = ExtractEventsContent(m, MessageType.reactionMessage);
    ev.emit(Events.Reactions, m, new Ctx({
        used,
        args: [],
        self,
        client: core
    }));
}

const MessageEventList = {
    [MessageType.pollCreationMessage]: emitPollCreation,
    [MessageType.pollUpdateMessage]: emitPollUpdate,
    [MessageType.reactionMessage]: emitReaction
};

module.exports = MessageEventList;