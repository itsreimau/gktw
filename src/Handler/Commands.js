const Baileys = require("baileys");
const Ctx = require("../Classes/Ctx.js");

async function Commands(self, _runMiddlewares) {
    const {
        m
    } = self;
    if (!m.message || Baileys.isJidStatusBroadcast(m.key.remoteJid) || Baileys.isJidNewsletter(m.key.remoteJid)) return;

    const hasHears = Array.from(self.hearsMap.values()).filter(hear => hear.name === m.text || hear.name === m.messageType || new RegExp(hear.name).test(m.text) || (Array.isArray(hear.name) && hear.name.includes(m.text)));

    if (hasHears.length) {
        const ctx = new Ctx({
            used: {
                hears: m.text
            },
            args: [],
            text: "",
            self,
            client: self.core
        });
        hasHears.forEach(hear => hear.code(ctx));
        return;
    }

    let selectedPrefix;
    const prefix = self.prefix;

    if (Array.isArray(prefix)) {
        if (prefix[0] === "") {
            const emptyIndex = prefix.findIndex(p => p === "");
            if (emptyIndex !== -1) {
                const newPrefix = [...prefix];
                const [empty] = newPrefix.splice(emptyIndex, 1);
                newPrefix.push(empty);
                selectedPrefix = newPrefix.find(p => m.text?.startsWith(p));
            } else {
                selectedPrefix = prefix.find(p => m.text?.startsWith(p));
            }
        } else {
            selectedPrefix = prefix.find(p => m.text?.startsWith(p));
        }
    } else if (prefix instanceof RegExp) {
        const match = m.text?.match(prefix);
        selectedPrefix = match ? match[0] : null;
    } else if (typeof prefix === "string") {
        selectedPrefix = m.text?.startsWith(prefix) ? prefix : null;
    }

    if (!selectedPrefix) return;

    const textWithoutPrefix = m.text?.slice(selectedPrefix.length).trim() || "";
    let args = textWithoutPrefix.split(/\s+/) || [];
    let commandName = args?.shift()?.toLowerCase();
    const text = textWithoutPrefix.slice(commandName.length) || "";

    if (!commandName) return;

    const commandsList = Array.from(self.cmd?.values() || []);
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

module.exports = Commands;