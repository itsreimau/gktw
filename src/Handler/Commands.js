"use strict";

const Ctx = require("../Classes/Ctx.js");
const Functions = require("../Helper/Functions.js");

async function Commands(self, runMiddlewares) {
    return new Promise((resolve, reject) => {
        let {
            cmd,
            prefix,
            m
        } = self;

        if (!m?.message || m.key?.remoteJid === "status@broadcast" || m.key?.remoteJid.endsWith("@newsletter") || m.key?.participant?.endsWith("@lid")) return resolve();
        if (!self.selfReply && m.key.fromMe) return resolve();

        const hasHears = Array.from(self.hearsMap.values()).filter(hear => hear.name === m.content || hear.name === m.messageType || new RegExp(hear.name).test(m.content) || (Array.isArray(hear.name) && hear.name.includes(m.content)));

        if (hasHears.length) {
            hasHears.forEach(hear => {
                hear.code(new Ctx({
                    used: {
                        hears: m.content
                    },
                    args: [],
                    self,
                    client: self.core
                }));
            });
            return resolve();
        }

        const commandsList = Array.from(cmd?.values() ?? []);
        let selectedPrefix;

        if (Array.isArray(prefix)) {
            if (prefix[0] == "") {
                const emptyIndex = prefix.findIndex(_prefix => _prefix.includes(""));
                prefix = Functions.arrayMove(prefix, emptyIndex - 1, prefix.length - 1);
            } else {
                selectedPrefix = prefix.find(_prefix => m.content?.startsWith(_prefix));
            }
        } else if (prefix instanceof RegExp) {
            const match = m.content?.match(prefix);
            if (match) selectedPrefix = match[0];
        }

        if (!selectedPrefix) return resolve();

        const args = m.content?.slice(selectedPrefix.length).trim().split(/\s+/) || [];
        const commandName = args?.shift()?.toLowerCase();
        if (!commandName) return resolve();

        const matchedCommands = commandsList.filter(command => command.name.toLowerCase() === commandName || (Array.isArray(command.aliases) ? command.aliases.includes(commandName) : command.aliases === commandName));

        if (!matchedCommands.length) return resolve();

        const ctx = new Ctx({
            used: {
                prefix: selectedPrefix,
                command: commandName
            },
            args,
            self,
            client: self.core
        });

        runMiddlewares(ctx).then(shouldContinue => {
            if (!shouldContinue) return resolve();

            matchedCommands.forEach(cmd => cmd.code(ctx));
            resolve();
        }).catch(reject);
    });
}

module.exports = Commands;