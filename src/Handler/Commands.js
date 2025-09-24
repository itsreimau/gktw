"use strict";

const Baileys = require("baileys");
const Ctx = require("../Classes/Ctx.js");

async function Commands(self, runMiddlewares) {
    const {
        cmd,
        prefix,
        m
    } = self;
    if (!m.message || Baileys.isJidStatusBroadcast(m.key.remoteJid) || Baileys.isJidNewsletter(m.key.remoteJid)) return;

    await handleHears(self, m);
    await processCommands(self, runMiddlewares, m, cmd, prefix);
}

async function handleHears(self, m) {
    const hearsEntries = Array.from(self.hearsMap.values());
    const matchingHears = hearsEntries.filter(hear => hear.name === m.content || hear.name === m.messageType || (hear.name instanceof RegExp && hear.name.test(m.content)) || (Array.isArray(hear.name) && hear.name.includes(m.content)));
    if (matchingHears.length === 0) return;

    const ctx = new Ctx({
        used: {
            hears: m.content
        },
        args: [],
        self,
        client: self.core
    });

    await Promise.allSettled(matchingHears.map(hear => Promise.resolve(hear.code(ctx))));
}

async function processCommands(self, runMiddlewares, m, cmd, prefix) {
    const selectedPrefix = findMatchingPrefix(m.content, prefix);
    if (!selectedPrefix) return;

    const {
        commandName,
        args
    } = parseCommand(m.content, selectedPrefix);
    if (!commandName) return;

    const matchedCommands = findMatchingCommands(cmd, commandName);
    if (matchedCommands.length === 0) return;

    const ctx = new Ctx({
        used: {
            prefix: selectedPrefix,
            command: commandName
        },
        args,
        self,
        client: self.core
    });

    const shouldContinue = await runMiddlewares(ctx);
    if (!shouldContinue) return;

    await Promise.allSettled(matchedCommands.map(command => Promise.resolve(command.code(ctx))));
}

function findMatchingPrefix(content, prefix) {
    if (Array.isArray(prefix)) return prefix.find(_prefix => content.startsWith(_prefix));

    if (prefix instanceof RegExp) {
        const match = content.match(prefix);
        return match?.[0];
    }

    return content.startsWith(prefix) ? prefix : null;
}

function parseCommand(content, selectedPrefix) {
    const remainingContent = content.slice(selectedPrefix.length).trim();
    if (!remainingContent) return {
        commandName: null,
        args: []
    };

    const parts = remainingContent.split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    return {
        commandName,
        args
    };
}

function findMatchingCommands(cmd, commandName) {
    const commandsList = Array.from(cmd?.values() ?? []);
    return commandsList.filter(command => command.name?.toLowerCase() === commandName || (Array.isArray(command.aliases) && command.aliases.includes(commandName)) || command.aliases === commandName);
}

module.exports = Commands;