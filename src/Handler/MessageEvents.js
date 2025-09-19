"use strict";

const ExtractEventsContent = require("./ExtractEventsContent.js");
const MessageType = require("../Constant/MessageType.js");
const Events = require("../Constant/Events.js");
const Ctx = require("../Classes/Ctx.js");

const emitPollCreation = async (m, ev, self, core) => {
    const {
        message: {
            pollCreationMessage
        }
    } = m;
    const used = ExtractEventsContent(m, MessageType.pollCreationMessage);
    const pollValues = pollCreationMessage.options.map(({
        optionName
    }) => optionName);
    const pollSingleSelect = Boolean(pollCreationMessage.selectableOptionsCount);
    const createContext = (usedValue) => new Ctx({
        used: usedValue,
        args: [],
        self,
        client: core
    });
    Object.assign(m, {
        pollValues,
        pollSingleSelect
    });
    ev.emit(Events.Poll, m, createContext(used));
};

const emitPollUpdate = async (m, ev, self, core) => {
    const used = ExtractEventsContent(m, MessageType.pollUpdateMessage);
    const createContext = (usedValue) => new Ctx({
        used: usedValue,
        args: [],
        self,
        client: core
    });
    ev.emit(Events.PollVote, m, createContext(used));
};

const emitReaction = async (m, ev, self, core) => {
    const used = ExtractEventsContent(m, MessageType.reactionMessage);
    const createContext = (usedValue) => new Ctx({
        used: usedValue,
        args: [],
        self,
        client: core
    });
    ev.emit(Events.Reactions, m, createContext(used));
};

const createEventContext = (used, self, core) => new Ctx({
    used,
    args: [],
    self,
    client: core
});

const MessageEventList = Object.freeze({
    [MessageType.pollCreationMessage]: emitPollCreation,
    [MessageType.pollUpdateMessage]: emitPollUpdate,
    [MessageType.reactionMessage]: emitReaction
});

module.exports = MessageEventList;