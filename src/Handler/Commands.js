const Baileys = require("baileys");

async function Commands(self, _runMiddlewares) {
    const Ctx = require("../Classes/Ctx.js");
    const {
        m,
        prefix,
        cmd
    } = self;

    if (!m.message || Baileys.isJidStatusBroadcast(m.key.remoteJid) || Baileys.isJidNewsletter(m.key.remoteJid)) return;

    const hasHears = Array.from(self.hearsMap.values()).filter(hear => hear.name === m.body || hear.name === m.messageType || new RegExp(hear.name).test(m.body) || (Array.isArray(hear.name) && hear.name.includes(m.body)));
    if (hasHears.length) {
        const ctx = new Ctx({
            used: {
                hears: m.body
            },
            args: [],
            text: "",
            self,
            client: self.core
        });
        return hasHears.forEach(hear => hear.code(ctx));
    }

    const {
        command,
        args,
        commandName,
        text,
        selectedPrefix
    } = parseCommand(prefix, m.body);

    if (!commandName) return;

    const commandsList = Array.from(cmd?.values() || []);
    const matchedCommands = commandsList.filter(command => command.name?.toLowerCase() === commandName || (Array.isArray(command.aliases) ? command.aliases.includes(commandName) : command.aliases === commandName));

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
    if (!await _runMiddlewares(ctx)) return;

    matchedCommands.forEach(cmd => cmd.code(ctx));
}

function parseCommand(prefix, body) {
    let selectedPrefix;

    if (Array.isArray(prefix)) {
        if (prefix[0] === "") {
            const emptyIndex = prefix.findIndex(pref => pref === "");
            if (emptyIndex !== -1) {
                const newPrefix = [...prefix];
                const [empty] = newPrefix.splice(emptyIndex, 1);
                newPrefix.push(empty);
                selectedPrefix = newPrefix.find(pref => body?.startsWith(pref));
            } else {
                selectedPrefix = prefix.find(pref => body?.startsWith(pref));
            }
        } else {
            selectedPrefix = prefix.find(pref => body?.startsWith(pref));
        }
    } else if (prefix instanceof RegExp) {
        const match = body?.match(prefix);
        selectedPrefix = match ? match[0] : null;
    } else if (typeof prefix === "string") {
        selectedPrefix = body?.startsWith(prefix) ? prefix : null;
    }

    if (!selectedPrefix)
        return {
            command: null,
            args: [],
            commandName: null,
            text: null,
            selectedPrefix: null
        };

    const command = body?.slice(selectedPrefix.length).trim() || "";
    let args = command.split(/\s+/) || [];
    let commandName = args?.shift()?.toLowerCase();
    const text = command.slice(commandName.length).trim() || "";

    return {
        command,
        args,
        commandName,
        text,
        selectedPrefix
    };
}

module.exports = Commands;
module.exports.parseCommand = parseCommand;