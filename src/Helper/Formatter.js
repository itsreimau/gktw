"use strict";

const bold = (text) => `*${text}*`;
const italic = (text) => `_${text}_`;
const strikethrough = (text) => `~${text}~`;
const quote = (text) => `> ${text}`;
const monospace = (text) => `\`\`\`${text}\`\`\``;
const inlineCode = (text) => `\`${text}\``;

module.exports = {
    bold,
    italic,
    strikethrough,
    quote,
    monospace,
    inlineCode
};