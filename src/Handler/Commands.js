const Baileys = require("baileys");
const Ctx = require("../Classes/Ctx.js");

async function Commands(self, _runMiddlewares) {
    const {
        m
    } = self;
    if (!m.message || Baileys.isJidStatusBroadcast(m.key.remoteJid) || Baileys.isJidNewsletter(m.key.remoteJid)) return;

    await _handleHears(self, m);
    await _processCommands(self, m, _runMiddlewares);
}

async function _handleHears(self, m) {
    const hearsEntries = Array.from(self.hearsMap.values());
    const matches = hearsEntries.filter(hear => hear.name === m.text || hear.name === m.messageType || (hear.name instanceof RegExp && hear.name.test(m.text)) || (Array.isArray(hear.name) && hear.name.includes(m.text)));

    if (!matches.length) return;

    const ctx = new Ctx({
        used: {
            hears: m.text
        },
        args: [],
        self,
        client: self.core
    });

    await Promise.allSettled(matches.map(hear => hear.code(ctx)));
}

async function _processCommands(self, m, _runMiddlewares) {
    const selectedPrefix = _findMatchingPrefix(m.text, self.prefix);
    if (!selectedPrefix) return;

    const {
        commandName,
        args,
        text
    } = _parseCommand(m.text, selectedPrefix);
    if (!commandName) return;

    const matchedCommands = _findMatchingCommands(self.cmd, commandName);
    if (!matchedCommands.length) return;

    const ctx = new Ctx({
        used: {
            prefix: selectedPrefix,
            command: commandName
        },
        args,
        text,
        self,
        client: self.core
    });

    const shouldContinue = await _runMiddlewares(ctx);
    if (!shouldContinue) return;

    await Promise.allSettled(matchedCommands.map(command => command.code(ctx)));
}

function _findMatchingPrefix(content, prefix) {
    if (Array.isArray(prefix)) return prefix.find(p => content.startsWith(p));
    if (prefix instanceof RegExp) return content.match(prefix)?.[0];
    return content.startsWith(prefix) ? prefix : null;
}

function _parseCommand(content, selectedPrefix) {
    const remaining = content.slice(selectedPrefix.length).trim();
    if (!remaining) return {
        commandName: null,
        args: [],
        text: ""
    };

    const parts = remaining.split(/\s+/);
    return {
        commandName: parts[0]?.toLowerCase(),
        args: parts.slice(1),
        text: remaining
    };
}

function _findMatchingCommands(cmd, commandName) {
    const commandsList = Array.from(cmd.values());
    return commandsList.filter(command => command.name?.toLowerCase() === commandName || (Array.isArray(command.aliases) && command.aliases.includes(commandName)) || command.aliases === commandName);
}

module.exports = Commands;