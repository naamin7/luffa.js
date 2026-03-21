import 'dotenv/config';
import { Client } from 'luffa.js';
import { detectIntent } from './bot/intent';
import { db } from './db';
import { generateWatchlistForUser } from './api/generateWatchlist';

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

  // After th wallet is linked, this fires from /api/link-wallet... also: see db event pattern below
});

client.start().then(() => {
  console.log('Luffa bot started, polling...');
}).catch(console.error);

export { client };