import 'dotenv/config';
import { Client } from 'luffa.js';
import { detectIntent } from './bot/intent';
import { db } from './db';
import { generateWatchlistForUser } from './api/generateWatchlist';

async function askClaude(prompt) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CLAUDE_API_KEY in environment variables');
  }

  const apiUrl = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/complete';
  const model = process.env.CLAUDE_MODEL || 'claude-2.1';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      prompt: `Human: ${prompt}\n\nAssistant:`,
      max_tokens_to_sample: Number(process.env.CLAUDE_MAX_TOKENS || 500),
      temperature: Number(process.env.CLAUDE_TEMPERATURE || 0.5),
      stop_sequences: ['\n\nHuman:'],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return (data.completion || data.completion_text || '').trim() || 'Sorry, I could not generate a response.';
}

const client = new Client({
  secret: process.env.LUFFA_SECRET!,
  pollInterval: 1000,
});

client.onMessage(async (msg) => {
  const intent = detectIntent(msg.content);

  if (intent === 'connect_wallet') {
    const connectUrl = `${process.env.APP_URL}/connect-wallet?user_id=${msg.authorId}`;

    if (msg.isGroup) {
      await msg.reply({
        text: "Import your portfolio automatically.\n\nClick below to connect your wallet:",
        buttons: [
          { label: "Connect Wallet", value: connectUrl }
        ],
        dismissType: "select"
      });
    } else {
      // DM func 
      await msg.reply(
        `Import your portfolio automatically.\n\nConnect your wallet here:\n${connectUrl}`
      );
    }
    return;
  }

  // After the wallet is linked, this fires from /api/link-wallet... also: (see db event pattern below)

  // Fallback: respond with Claude-generated AI assistance for other queries.
  try {
    const replyText = await askClaude(msg.content);
    await msg.reply(replyText);
  } catch (err) {
    console.error('Claude reply failed:', err);
    await msg.reply("Sorry, I couldn't generate an AI response right now. Please try again later.");
  }
});

client.start().then(() => {
  console.log('Luffa bot started, polling...');
}).catch(console.error);

export { client };