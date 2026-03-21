import Anthropic from "@anthropic-ai/sdk";
import { luffaClient } from "./client";
import { detectIntent } from "./intent";
import { db } from "../db";
import { getTokens } from "../services/alchemy";
import {
  collectIntelForUser,
  buildIntelContext,
} from "../services/collector";
import { analyzeAllTokenSignals } from "../services/signals";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

function buildPortfolioContext(userId: string): string {
  const user = db.getUser(userId);
  const watchlist = db.getWatchlist(userId);

  let context = "";

  if (user?.wallet_address) {
    context += `The user has linked wallet: ${user.wallet_address}\n`;
  } else {
    context +=
      "The user has NOT linked a wallet yet. Guide them to say 'connect wallet' to get started.\n";
  }

  if (watchlist && watchlist.tokens.length > 0) {
    const tokenList = watchlist.tokens
      .map((t) => `- ${t.symbol} (${t.token_name}): ${t.balance.toFixed(4)}`)
      .join("\n");
    context += `\nTheir current portfolio:\n${tokenList}\n`;
  } else if (user?.wallet_address) {
    context +=
      "They have a wallet linked but no watchlist generated yet. Suggest they say 'generate watchlist' to scan their tokens.\n";
  }

  const intelContext = buildIntelContext(userId);
  if (intelContext) {
    context += intelContext;
  }

  return context;
}

async function askClaude(prompt: string, userId: string): Promise<string> {
  const portfolioContext = buildPortfolioContext(userId);

  const systemPrompt = `You are InvesTrack, an AI crypto portfolio assistant on the Luffa messaging platform. Help users track and understand their Ethereum tokens.

${portfolioContext}

Rules:
- Keep responses short and conversational (2-4 sentences max).
- If they ask about their holdings, reference the actual tokens in their portfolio above.
- If they have no wallet linked, tell them to say "connect wallet".
- If they have a wallet but no watchlist, tell them to say "generate watchlist".
- If they ask about risks, signals, or red flags, reference the Collected Intelligence section above. Be specific about what was found.
- If signal analysis has been run, mention the risk level and any red flags for relevant tokens.
- If they ask for a report, give a structured summary of each token with risk level, key findings, and red flags.
- When discussing risks, present facts from the data. Do not speculate beyond the evidence.
- Never give financial advice or tell users to buy/sell. You can share factual info about tokens.
- Do not use emoji.`;

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    max_tokens: Number(process.env.CLAUDE_MAX_TOKENS || 500),
    system: systemPrompt,
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
            (t) =>
              `${t.symbol} (${t.token_name}): ${t.balance.toFixed(4)}`
          );
          await msg.reply(
            `Found ${tokens.length} tokens:\n\n${lines.join("\n")}\n\nCollecting project data in the background. Say 'scan' when ready to check for red flags.`
          );

          collectIntelForUser(userId).catch((err) => {
            console.error("Background intel collection failed:", err);
          });
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

        case "scan_signals": {
          const user = db.getUser(userId);
          if (!user?.wallet_address) {
            await msg.reply(
              "Link a wallet first, then generate a watchlist before scanning for signals."
            );
            break;
          }

          const watchlist = db.getWatchlist(userId);
          if (!watchlist || watchlist.tokens.length === 0) {
            await msg.reply(
              "Generate a watchlist first by saying 'generate watchlist'."
            );
            break;
          }

          await msg.reply(
            `Collecting data and scanning ${watchlist.tokens.length} tokens for red flags. This may take a minute...`
          );

          await collectIntelForUser(userId);
          await analyzeAllTokenSignals(userId);

          const intelEntries = db.getAllTokenIntel(
            watchlist.tokens.map((t) => t.contract_address)
          );

          const flaggedTokens = intelEntries.filter(
            (i) =>
              i.signals &&
              (i.signals.risk_level === "high" ||
                i.signals.risk_level === "critical")
          );

          if (flaggedTokens.length === 0) {
            const analyzed = intelEntries.filter((i) => i.signals).length;
            await msg.reply(
              `Scan complete. Analyzed ${analyzed} of ${watchlist.tokens.length} tokens. No high-risk signals detected. Say 'report' for a detailed breakdown.`
            );
          } else {
            const flagLines = flaggedTokens.map((i) => {
              const token = watchlist.tokens.find(
                (t) =>
                  t.contract_address.toLowerCase() ===
                  i.contract_address.toLowerCase()
              );
              const name = token
                ? token.symbol
                : i.contract_address.substring(0, 10);
              const level = i.signals!.risk_level.toUpperCase();
              const topFlag =
                i.signals!.red_flags[0] || "See full report";
              return `${name}: ${level} - ${topFlag}`;
            });

            await msg.reply(
              `Scan complete. Found ${flaggedTokens.length} token(s) with elevated risk:\n\n${flagLines.join("\n")}\n\nSay 'report' for full details.`
            );
          }
          break;
        }

        case "token_report": {
          const watchlist = db.getWatchlist(userId);
          if (!watchlist || watchlist.tokens.length === 0) {
            await msg.reply("No watchlist found. Generate one first.");
            break;
          }

          const aiReply = await askClaude(msg.content, userId);
          await msg.reply(aiReply);
          break;
        }

        default: {
          const aiReply = await askClaude(msg.content, userId);
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
