module.exports = {
    bold: text => `*${text}*`,
    italic: text => `_${text}_`,
    strikethrough: text => `~${text}~`,
    quote: text => `> ${text}`,
    monospace: text => `\`\`\`${text}\`\`\``,
    inlineCode: text => `\`${text}\``
};