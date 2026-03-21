import Anthropic from "@anthropic-ai/sdk";
import { luffaClient } from "./client";
import { detectIntent } from "./intent";
import { db } from "../db";
import { getTokens } from "../services/alchemy";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

async function askClaude(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    max_tokens: Number(process.env.CLAUDE_MAX_TOKENS || 500),
    system:
      "You are InvesTrack, an AI crypto portfolio assistant. Help users track their Ethereum tokens. Keep responses short and direct.",
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  return block.type === "text"
    ? block.text
    : "I could not generate a response.";
}

export function registerHandlers() {
  luffaClient.onMessage(async (msg: any) => {
    const userId = msg.authorId;

    db.setUser(userId, {
      user_id: userId,
      channelId: msg.channelId,
      isGroup: msg.isGroup,
    });

    const intent = detectIntent(msg.content);

    try {
      switch (intent) {
        case "connect_wallet": {
          const connectUrl = `${process.env.APP_URL}/connect-wallet?user_id=${userId}`;

          if (msg.isGroup) {
            await msg.reply({
              text: "Connect your wallet to start tracking your portfolio:",
              buttons: [
                { label: "Connect Wallet", value: connectUrl },
              ],
              dismissType: "select",
            });
          } else {
            await msg.reply(
              `Connect your wallet here:\n${connectUrl}`
            );
          }
          break;
        }

        case "link_address": {
          const address = msg.content.trim();
          db.setUser(userId, { wallet_address: address.toLowerCase() });
          await msg.reply(
            "Wallet linked. Say 'generate watchlist' to fetch your tokens."
          );
          break;
        }

        case "generate_watchlist": {
          const user = db.getUser(userId);
          if (!user || !user.wallet_address) {
            const connectUrl = `${process.env.APP_URL}/connect-wallet?user_id=${userId}`;
            await msg.reply(
              `No wallet linked yet. Connect first:\n${connectUrl}`
            );
            break;
          }

          await msg.reply("Scanning your wallet for tokens...");

          const tokens = await getTokens(user.wallet_address);
          db.setWatchlist(userId, tokens);

          if (tokens.length === 0) {
            await msg.reply(
              "No tokens found in your wallet after filtering spam and dust."
            );
            break;
          }

          const lines = tokens.map(
            (t) => `${t.symbol} (${t.token_name}): ${t.balance.toFixed(4)}`
          );
          await msg.reply(
            `Found ${tokens.length} tokens:\n\n${lines.join("\n")}`
          );
          break;
        }

        case "get_watchlist": {
          const watchlist = db.getWatchlist(userId);
          if (!watchlist || watchlist.tokens.length === 0) {
            await msg.reply(
              "Your watchlist is empty. Say 'generate watchlist' to build one from your wallet."
            );
            break;
          }

          const lines = watchlist.tokens.map(
            (t) => `${t.symbol} (${t.token_name})`
          );
          await msg.reply(
            `Your watchlist (${watchlist.tokens.length} tokens):\n\n${lines.join("\n")}`
          );
          break;
        }

        default: {
          const aiReply = await askClaude(msg.content);
          await msg.reply(aiReply);
          break;
        }
      }
    } catch (err) {
      console.error("Handler error:", err);
      await msg.reply(
        "Something went wrong. Try again or say 'connect wallet' to start."
      );
    }
  });
}
