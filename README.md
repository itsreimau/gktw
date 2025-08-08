# <div align="center">@itsreimau/gktw - Useless Baileys Wrapper</div>

<div align="center">
  <img src="https://www.ultraimagehub.com/wallpapers/tr:flp-false,gx-0.6,gy-0.5,q-75,rh-3264,rw-5824,th-1080,tw-1920/1237967402915074098.jpeg" alt="Banner" />
</div>

## 📖 Table of Contents

- [Important Note](#-important-note)
- [Installation](#-installation)
- [Key Features](#-key-features)
- [Quick Start](#-quick-start)
  - [Basic Example](#-basic-example)
  - [Using Events](#-using-events)
- [Client Configuration](#-client-configuration)
- [Custom Authentication](#-custom-authentication)
- [Events Reference](#-events-reference)
- [Command System](#-command-system)
  - [Command Options](#-command-options)
  - [Command Handler](#-command-handler)
- [Middleware System](#-middleware-system)
- [Cooldown System](#-cooldown-system)
- [Message Sending](#-message-sending)
- [Text Formatting](#-text-formatting)
- [Media Handling](#-media-handling)
- [Message Editing](#-message-editing)
- [Message Deletion](#-message-deletion)
- [Poll Messages](#-poll-messages)
- [Builders](#-builders)
  - [Contact Builder](#-contact-builder)
- [Collectors](#-collectors)
  - [Message Collector](#-message-collector)
  - [Awaited Messages](#-awaited-messages)
- [Mentions](#-mentions)
  - [Manual Mentions](#-manual-mentions)
  - [Auto Mentions](#-auto-mentions)
  - [Get Mentions](#-get-mentions)
- [Group Management](#-group-management)
- [Miscellaneous Utilities](#-miscellaneous-utilities)
- [Acknowledgements](#-acknowledgements)

## ⚠️ Important Note

This is a custom fork of [@mengkodingan/ckptw](https://npmjs.com/package/@mengkodingan/ckptw) **only for [gaxtawu](https://github.com/itsreimau/gaxtawu)**.

🚫 **Not recommended for other projects** – consider these alternatives instead:
- [@aidulcandra/simple-wa-bot](https://www.npmjs.com/package/@aidulcandra/simple-wa-bot)
- [@neoxr/wb](https://www.npmjs.com/package/@neoxr/wb)
- [wachan](https://www.npmjs.com/package/wachan)
- [zaileys](https://www.npmjs.com/package/zaileys)

🔧 Original functions remain (see [original docs](https://npmjs.com/package/@mengkodingan/ckptw)).

## 📥 Installation

```bash
npm install github:itsreimau/gktw
```

## ✨ Key Features

- **✨ Effortless** - Simple and intuitive API
- **🔧 Fixed @lid & @jid** - Resolved WhatsApp group @lid and @jid issues
- **🧱 Builder** - Build complex messages easily
- **🛒 Built-in Collector, Cooldown, Command Handle** - Essential utilities included
- **🚀 Middleware System** - Intercept and process messages
- **💽 Custom Auth Adapter** - Flexible session storage options
- **📦 Group Metadata Caching** - Prevents API overlimit with efficient caching
- **🔌 CommonJS Only** - Optimized for CJS environments
- **🎉 And more!** - Extensive WhatsApp feature support

## 🚀 Quick Start

### ▸ Basic Example

```js
const { Client, Events, MessageType } = require("@itsreimau/gktw");

const bot = new Client({
    prefix: "!",
    printQRInTerminal: true,
    readIncomingMsg: true
});

bot.ev.once(Events.ClientReady, (m) => {
    console.log(`Bot ready as ${m.user.id}`);
});

bot.command("ping", async (ctx) => await ctx.reply("Pong!"));
bot.command("hi", async (ctx) => await ctx.reply("Hello! String replies work too!"));

bot.hears("test", async (ctx) => await ctx.reply("Testing?"));
bot.hears(MessageType.stickerMessage, async (ctx) => await ctx.reply("Cool sticker!"));
bot.hears(["help", "menu"], async (ctx) => await ctx.reply("Array matching works!"));
bot.hears(/(using\s?)?regex/, async (ctx) => await ctx.reply("Regex matching works!"));

bot.launch();
```

### ▸ Using Events

```js
const { Client, Events } = require("@itsreimau/gktw");

const bot = new Client({
    prefix: "!",
    printQRInTerminal: true,
    readIncomingMsg: true
});

bot.ev.once(Events.ClientReady, (m) => {
    console.log(`Bot ready as ${m.user.id}`);
});

bot.ev.on(Events.MessagesUpsert, async (m, ctx) => {
    if (m.key.fromMe) return;
    if (m.content === "Does this impact the lore?") {
        await ctx.reply("Yes Rei, it does.");
    }
});

bot.launch();
```

## ⚙️ Client Configuration

```js
ClientOptions {
    prefix: Array<string> | string | RegExp; // Bot prefix(es)
    readIncomingMsg?: boolean; // Mark incoming messages as read (default: false)
    authDir?: string; // Path to auth directory (default: "./state")
    printQRInTerminal?: boolean; // Display QR in terminal (default: false)
    qrTimeout?: number; // QR regeneration timeout in ms (default: 60000)
    markOnlineOnConnect?: boolean; // Mark online on connect (default: true)
    phoneNumber?: string; // Bot phone number with country code (e.g. '62xxx')
    usePairingCode?: boolean; // Use pairing code instead of QR (default: false)
    customPairingCode?: string; // Custom pairing code
    selfReply?: boolean; // Allow bot to respond to itself (default: false)
    WAVersion?: [number, number, number]; // Custom WhatsApp version
    autoMention?: boolean; // Auto-convert @mentions (default: false)
    authAdapter?: Promise<any>; // Custom auth adapter
    browser?: WABrowserDescription; // Browser configuration
}
```

## 🔐 Custom Authentication

Use alternative auth storage adapters:

```js
const { useMySQLAuthState } = require("mysql-baileys");

const bot = new Client({
    authAdapter: useMySQLAuthState({
        session: "botwangsap",
        password: "admin#123",
        database: "baileys"
    })
    // ... Other options
});
```

## 📡 Events Reference

Available events for handling various WhatsApp activities:

```js
const { Events } = require("@itsreimau/gktw");

// Example event usage
bot.ev.on(Events.MessagesUpsert, (m, ctx) => {
    console.log("New message:", m);
});
```

**Available Events:**

- `ClientReady`: Bot initialization complete
- `MessagesUpsert`: New message received
- `QR`: QR code generated
- `GroupsJoin`: Bot joined a group
- `UserJoin`: User joined a group
- `UserLeave`: User left a group
- `Poll`: Poll created
- `PollVote`: Poll vote received
- `Reactions`: Message reaction
- `Call`: Incoming/outgoing call
- `ConnectionUpdate`: Connection status change

## 🛠️ Command System

### ▸ Command Options

Commands can be defined in two ways:

1. Simple string command:

```js
bot.command("ping", async (ctx) => await ctx.reply("Pong!"));
```

2. Full command object:

```js
bot.command({
    name: "ping",
    aliases: ["p"], // Optional aliases
    code: async (ctx) => await ctx.reply("Pong!")
});
```

### ▸ Command Handler

For better organization, commands can be split into separate files:

#### ▸ Main File Setup

```js
const { CommandHandler } = require("@itsreimau/gktw");
const path = require("path");

const cmd = new CommandHandler(bot, path.resolve(__dirname, "commands"));
cmd.load(true); // Set to false to suppress loading logs
```

#### ▸ Command File Structure

```js
// commands/ping.js
module.exports = {
    name: "ping",
    code: async (ctx) => {
        await ctx.reply("Pong!");
    }
};

// commands/greeting.js (hears type example)
module.exports = {
    name: "greeting",
    type: "hears", // Can be "command" or "hears"
    code: async (ctx) => {
        await ctx.reply("Hello there!");
    }
};
```

## 🔄 Middleware System

Middleware allows pre-processing of messages before command execution:

```js
bot.use(async (ctx, next) => {
    console.log(`Received message: ${ctx.msg.content}`);

    // Example: Block messages from specific users
    if (ctx.sender.id === "1234@s.whatsapp.net") return await ctx.reply("You are blocked!");

    await next(); // Continue processing
});
```

**Key Notes:**

- Middlewares execute in registration order
- Call `next()` to continue processing
- Return early to block command execution

## ⏳ Cooldown System

Prevent command spamming with cooldowns:

```js
const { Cooldown } = require("@itsreimau/gktw");

bot.command("ping", async (ctx) => {
    const cd = new Cooldown(ctx, 8000); // 8 second cooldown

    if (cd.onCooldown) return await ctx.reply(`Please wait ${cd.timeleft}ms before using this again`);

    await ctx.reply("Pong!");

    // Optional cooldown end handler
    cd.on("end", () => {
        console.log("Cooldown expired");
    });
});
```

**Cooldown Properties:**

- `onCooldown`: Boolean indicating if active
- `timeleft`: Remaining time in milliseconds

## 💬 Message Sending

Various message types can be sent:

```js
// Text message
await ctx.reply("Hello world!");

// Image with caption
await ctx.reply({ image: { url: "https://example.com/image.jpg" }, caption: "Check this out!" });

// Audio message
await ctx.reply({ audio: { url: "./sound.mp3" }, mimetype: "audio/mp4", ptt: true /* Send as voice note */ });

// Video message
const fs = require("fs");
await ctx.reply({ video: fs.readFileSync("./video.mp4"), caption: "Watch this!", gifPlayback: false });

// Sticker
await ctx.reply({ sticker: { url: "./sticker.webp" } });
```

For buttons and interactive messages, refer to [Baileys documentation](https://www.npmjs.com/package/@yupra/baileys).

## 🎨 Text Formatting

Format messages with WhatsApp's text styles:

```js
const { Formatter } = require("@itsreimau/gktw");

await ctx.reply(Formatter.bold("Does this impact the lore?"));
```

Supported formatting functions:

- `Formatter.bold(text)`
- `Formatter.italic(text)`
- `Formatter.strikethrough(text)`
- `Formatter.quote(text)`
- `Formatter.inlineCode(text)`
- `Formatter.monospace(text)`
- `Formatter.smallCaps(text)`

## 🖼️ Media Handling

Download and process media attachments:

```js
const { MessageType } = require("@itsreimau/gktw");
const fs = require("fs");

bot.ev.on(Events.MessagesUpsert, async (m, ctx) => {
    if (ctx.getMessageType() === MessageType.imageMessage) {
        const buffer = await ctx.msg.media.toBuffer();
        fs.writeFileSync("image.jpeg", buffer);
        await ctx.reply("Image saved!");
    }
});
```

**Media Access Methods:**

```js
// Current message
await ctx.msg.media.toBuffer();
await ctx.msg.media.toStream();

// Quoted message
await ctx.quoted?.media.toBuffer();
await ctx.quoted?.media.toStream();
```

## ✏️ Message Editing

Edit sent messages:

```js
const sentMsg = await ctx.reply("Does this impact the lore?");
await ctx.editMessage(sentMsg.key, "Yes Rei, it does.");
```

## 🗑️ Message Deletion

Delete messages:

```js
const sentMsg = await ctx.reply("Third Impact!");
await ctx.deleteMessage(sentMsg.key);
```

## 📊 Poll Messages

Create polls:

```js
await ctx.sendPoll(ctx.id, { name: "Does this impact the lore?", values: ["Yes Rei, it does.", "No!"], singleSelect: true /* Allow only one selection */ });
```

## 🧱 Builders

### ▸ Contact Builder

Create and send contact cards:

```js
const { VCardBuilder } = require("@itsreimau/gktw");

const vcard = new VCardBuilder()
    .setFullName("Ayanami Rei")
    .setOrg("NERV")
    .setNumber("1234")
    .build();

await ctx.reply({ contacts: { displayName: "Rei", contacts: [{ vcard }] } });
```

## 📥 Collectors

Collect messages with flexible filtering:

### ▸ Message Collector

```js
const col = ctx.MessageCollector({
    time: 10000, // 10 second timeout
    max: 5, // Max 5 messages
    filter: (m) => m.sender === ctx.sender.id, // Only collect from sender
    hears: ["1234@s.whatsapp.net", "4321@g.us"] // You can also collect from other chats
});

await ctx.reply("Say something... (10s timeout)");

col.on("collect", async (m) => {
    await ctx.reply(`Collected: ${m.content}`);
});

col.on("end", async (_, reason) => {
    await ctx.reply(`Collection ended: ${reason}`);
});
```

### ▸ Awaited Messages

Simplified message collection:

```js
ctx.awaitMessages({ time: 10000 })
    .then(async (messages) => await ctx.reply(`Got ${messages.length} messages`))
    .catch(async () => await ctx.reply("Timed out"));
```

## 📍 Mentions

### ▸ Manual Mentions

```js
await ctx.reply({ text: "Get in the EVA, @1234!", mentions: ["1234@s.whatsapp.net"] /* Full JID required */ });
```

### ▸ Auto Mentions

Enable in client config:

```js
const bot = new Client({
    autoMention: true // Enable automatic mention conversion
});

// Now @mentions will work automatically
await ctx.reply("Get in the EVA, @1234!"); // No need for mentions array
```

### ▸ Get Mentions

Extract mentioned users from message:

```js
await ctx.getMentioned(); /* Returns array of JIDs like ["1234@s.whatsapp.net"]
```

## 👥 Group Management

Comprehensive group control:

```js
// Create group
await ctx.groups.create("NERV", ["1234@s.whatsapp.net"]);

// Group utilities
const group = await ctx.group(); // Current group
const group = await ctx.group("1234@g.us"); // Specify JID

// Common operations
await group.members();
await group.inviteCode();
await group.revokeInviteCode();
await group.joinApproval("on"); // Available: on, off
await group.leave();
await group.membersCanAddMemberMode("on"); // Available: on, off
await group.metadata();
await group.getMetadata("subject"); // Available: subject, desc, owner, etc.
await group.name();
await group.description();
await group.owner();
await group.isAdmin("1234@s.whatsapp.net");
await group.isOwner("1234@s.whatsapp.net");
await group.isSenderAdmin();
await group.isOwnerAdmin();
await group.isBotAdmin();
await group.toggleEphemeral(69);
await group.updateDescription("Does this impact the lore?");
await group.updateSubject("NERV");
await group.membersUpdate(["1234@s.whatsapp.net"], "remove"); // Available: remove, add, promote, demote
await group.kick(["1234@s.whatsapp.net"]);
await group.add(["1234@s.whatsapp.net"]);
await group.promote(["1234@s.whatsapp.net"]);
await group.demote(["1234@s.whatsapp.net"]);
await group.pendingMembers();
await group.pendingMembersUpdate(["1234@s.whatsapp.net"], "reject"); // Available: reject, approve
await group.approvePendingMembers(["1234@s.whatsapp.net"]);
await group.rejectPendingMembers(["1234@s.whatsapp.net"]);
await group.updateSetting("announcement"); // Available: announcement, not_announcement, locked, unlocked
await group.open();
await group.close();
await group.lock();
await group.unlock();
```

## 🔧 Miscellaneous Utilities

```js
const { Browsers, fetchLatestWaWebVersion, getContentType, generateWAMessageFromContent, proto } = require("@itsreimau/gktw"); // Maybe if you need some Baileys functionality

// Message reactions & pin
await ctx.react(ctx.id, "👍");
await ctx.pin(ctx.id, "86400");

// Get message details
ctx.args;
ctx.sender;
ctx.quoted;
ctx.me;

// Presence updates
ctx.simulateTyping();
ctx.simulateRecording();

// Profile management
bot.bio("GOD'S IN HIS HEAVEN, ALL'S RIGHT WITH THE WORLD");
await bot.fetchBio("1234@s.whatsapp.net");

// Block management
await ctx.block("1234@s.whatsapp.net");
await ctx.unblock("1234@s.whatsapp.net");

// Utility methods
ctx.isGroup();
ctx.getDevice("1234@s.whatsapp.net");
ctx.getPushname("1234@s.whatsapp.net");

// Accessing Baileys objects
bot.core;
ctx.core;
```

## 🙏 Acknowledgements

Special thanks to:

- [Jastin Linggar Tama](https://github.com/JastinXyz) for original ckptw
- [NaufalYP1](https://github.com/NaufalYuPra) for Baileys modification
- [WhiskeySockets](https://github.com/WhiskeySockets) for Baileys maintenance
- All contributors and users