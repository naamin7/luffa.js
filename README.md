# luffa.js

A lightweight, polling-based SDK for the Luffa Robot API.

## Features

- 🤖 Simple client for Luffa robots
- 📨 Send and receive messages (DM + group)
- 🔘 Group message buttons and @mentions
- ⚡ Automatic message deduplication
- 🛡️ Clean error handling with typed exceptions
- 📦 Zero dependencies

## Installation

```bash
npm install luffa.js
```

## Quick Start

```javascript
import { Client } from "luffa.js"; // 

const client = new Client({
  secret: "your_robot_secret",
  pollInterval: 1000 // ms, optional
});
```

## Claude AI Assistant (optional)

Add a Claude API key to enable generative responses for incoming messages:

- `CLAUDE_API_KEY` (required)
- `CLAUDE_API_URL` (optional, default: `https://api.anthropic.com/v1/complete`)
- `CLAUDE_MODEL` (optional, default: `claude-2.1`)
- `CLAUDE_MAX_TOKENS` (optional, default: `500`)
- `CLAUDE_TEMPERATURE` (optional, default: `0.5`)

Example `.env`:

```
LUFFA_SECRET=your_luffa_secret
CLAUDE_API_KEY=sk-xxxxx
APP_URL=https://your-app.url
```

Incoming messages that are not handled by custom commands now pass through Claude and the bot replies with the generated completion.

## API

client.onMessage(async (message) => {
  console.log(`${message.authorId}: ${message.content}`);
  
  // Reply to messages
  await message.reply("Thanks for your message!");
});

// Start the client
await client.start();
```

## API

### Client

#### Constructor

```javascript
new Client({ secret, pollInterval })
```

- `secret` (required): Robot API secret from Luffa
- `pollInterval` (optional): Poll frequency in milliseconds (default: 1000)

#### Methods

**`await client.start()`** — Start polling for messages. Validates the secret on startup.

```javascript
await client.start(); // throws if secret is invalid
```

**`client.stop()`** — Stop polling and shut down the client.

```javascript
client.stop();
```

**`client.onMessage(fn)`** — Register a handler for incoming messages.

```javascript
client.onMessage(async (message) => {
  console.log(message);
});
```

### Message

Each message passed to `onMessage` is a `Message` instance with these properties:

- `id` — Unique message ID
- `content` — Message text
- `authorId` — Sender's Luffa ID
- `channelId` — DM user ID or group ID
- `isGroup` — Boolean, true if from a group
- `raw` — Original API payload

#### Methods

**`await message.reply(text)`** — Simple text reply.

```javascript
await message.reply("Hello!");
```

**`await message.reply(options)`** — Reply with options (text, buttons, mentions).

```javascript
// Group reply with buttons
await message.reply({
  text: "Choose an option:",
  buttons: [
    { label: "Approve", value: "approve", hidden: false },
    { label: "Reject", value: "reject", hidden: true }
  ],
  dismissType: "select" // "select" or "dismiss"
});

// Group reply with confirm buttons (styled)
await message.reply({
  text: "Confirm action?",
  confirm: [
    { label: "Yes", value: "yes", style: "default" },
    { label: "No", value: "no", style: "destructive" }
  ]
});

// Reply with @mentions (auto-calculates offset)
await message.reply({
  text: "Hello team",
  mentions: [
    { uid: "user123", name: "user123" }
  ]
});
```

## Error Handling

The SDK exports two error types:

### SoftFailError

Thrown when the Luffa API returns an error in the response body (e.g., bad secret, permissions).

```javascript
import { SoftFailError } from "luffa.js";

try {
  await client.start();
} catch (err) {
  if (err instanceof SoftFailError) {
    console.error("API error:", err.message);
    console.error("Code:", err.code);
  }
}
```

### LuffaAPIError

Thrown when the response is malformed or cannot be parsed.

```javascript
import { LuffaAPIError } from "luffa.js";

try {
  await message.reply("test");
} catch (err) {
  if (err instanceof LuffaAPIError) {
    console.error("Protocol error:", err.message);
    console.error("Details:", err.details);
  }
}
```

## Constants

Import common constants:

```javascript
import { Constants } from "luffa.js";

Constants.MESSAGE_TYPE_PRIVATE; // 0
Constants.MESSAGE_TYPE_GROUP; // 1
Constants.GROUP_MESSAGE_TYPE_TEXT; // 1
Constants.GROUP_MESSAGE_TYPE_BUTTONS; // 2
Constants.BUTTON_TYPE_DEFAULT; // "default"
Constants.BUTTON_TYPE_DESTRUCTIVE; // "destructive"
Constants.DEFAULT_POLL_INTERVAL; // 1000
```

## Examples

### Echo bot

```javascript
import { Client } from "luffa.js";

const client = new Client({ secret: process.env.LUFFA_SECRET });

client.onMessage(async (msg) => {
  if (!msg.isGroup) {
    await msg.reply(`You said: ${msg.content}`);
  }
});

await client.start();
```

### Command handler

```javascript
client.onMessage(async (msg) => {
  if (msg.content === "!ping") {
    await msg.reply("pong!");
  }
  
  if (msg.content === "!help") {
    await msg.reply("Available commands: !ping, !help");
  }
});
```

### Group buttons

```javascript
client.onMessage(async (msg) => {
  if (msg.isGroup && msg.content === "!vote") {
    await msg.reply({
      text: "Vote now:",
      buttons: [
        { label: "👍 Yes", value: "yes" },
        { label: "👎 No", value: "no" }
      ],
      dismissType: "dismiss"
    });
  }
});
```

## Notes

- **Polling**: The SDK polls the API every 1 second. This is a limitation of Luffa's legacy API.
- **Deduplication**: Message deduplication is handled automatically via `msgId` tracking.
- **Soft-fail**: All Luffa API responses return HTTP 200, with errors in the body. The SDK handles this transparently.
- **Groups**: Group features (buttons, @mentions) are limited to group chats only.

## Versioning

- **0.x** → Breaking changes allowed (pre-stable)
- **1.0** → Stable API lock-in

## License

ISC
