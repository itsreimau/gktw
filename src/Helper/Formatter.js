"use strict";

const bold = (text) => `*${text}*`;

const italic = (text) => `_${text}_`;

const strikethrough = (text) => `~${text}~`;

const quote = (text) => `> ${text}`;

const monospace = (text) => `\`\`\`${text}\`\`\``;

const inlineCode = (text) => `\`${text}\``;

const smallCaps = (text) => {
    const lowercaseChars = "abcdefghijklmnopqrstuvwxyz1234567890".split("");
    const smallCapsChars = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ1234567890".split("");

    const charMap = lowercaseChars.map((char, index) => ({
        original: char,
        converted: smallCapsChars[index]
    }));

    return text.toLowerCase().split("").map(char => {
        const mappedChar = charMap.find(mapping => mapping.original === char);
        return mappedChar ? mappedChar.converted : char;
    }).join("");
};

module.exports = {
    bold,
    italic,
    strikethrough,
    quote,
    monospace,
    inlineCode,
    smallCaps
};