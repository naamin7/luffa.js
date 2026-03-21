import { luffaClient } from './client';
import { detectIntent } from './intent';
import { db } from '../db';

export function registerHandlers() {
  luffaClient.onMessage(async (msg: any) => {
    const userId = msg.authorId;

    // Always store channel context 
    db.setUser(userId, {
      user_id: userId,
      channelId: msg.channelId,
      isGroup: msg.isGroup,
    });

    const intent = detectIntent(msg.content);

    if (intent === 'connect_wallet') {
      const connectUrl = `${process.env.APP_URL}/connect-wallet?user_id=${userId}`;

      if (msg.isGroup) {
        await msg.reply({
          text: "Import your portfolio automatically.\n\nClick below to connect your wallet:",
          buttons: [
            { label: "🔗 Connect Wallet", value: connectUrl }
          ],
          dismissType: "select"
        });
      } else {
        // error handling 
        await msg.reply(
          `Import your portfolio automatically.\n\nConnect your wallet here:\n${connectUrl}`
        );
      }
      return;
    }

    if (intent === 'unknown') {
      // If user message isn't a known command, pass to Claude for an AI-driven reply.
      try {
        const aiReply = await askClaude(msg.content);
        await msg.reply(aiReply);
      } catch (err) {
        console.error('Claude reply failed:', err);
        await msg.reply("Say 'connect wallet' to link your portfolio and start tracking tokens.");
      }
      return;
    }

    // For all other messages (non-connect commands), ask Claude too.
    try {
      const aiReply = await askClaude(msg.content);
      await msg.reply(aiReply);
    } catch (err) {
      console.error('Claude reply failed:', err);
      await msg.reply("Sorry, I couldn't generate an AI response right now. Please try again later.");
    }
  });
}