import Anthropic from "@anthropic-ai/sdk";
import { luffaClient } from "./client";
import { detectIntent } from "./intent";
import { db } from "../db";
import { Token, getTokens } from "../services/alchemy";
import { searchToken, getTokenMetadata } from "../services/coingecko";
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
  }

  if (watchlist && watchlist.tokens.length > 0) {
    const tokenList = watchlist.tokens
      .map((t) => {
        const balancePart =
          t.balance > 0 ? ` - balance: ${t.balance.toFixed(4)}` : "";
        return `- ${t.symbol} (${t.token_name})${balancePart}`;
      })
      .join("\n");
    context += `\nTheir watchlist:\n${tokenList}\n`;
  } else {
    context +=
      "The user has no tokens in their watchlist yet. They can add tokens by saying 'add' followed by a token name or contract address.\n";
  }

  const intelContext = buildIntelContext(userId);
  if (intelContext) {
    context += intelContext;
  }

  return context;
}

async function askClaude(prompt: string, userId: string): Promise<string> {
  const portfolioContext = buildPortfolioContext(userId);

  const systemPrompt = `You are InvesTrack, an AI crypto portfolio assistant on the Luffa messaging platform. Help users research and track Ethereum tokens before and after they invest.

${portfolioContext}

Rules:
- Keep responses short and conversational (2-4 sentences max).
- FIRST PRIORITY: If the user has NOT linked a wallet yet, always guide them to say "connect wallet" first. This is the starting point.
- SECOND PRIORITY: Once a wallet is linked, if their watchlist is empty, guide them to add tokens by saying "add" followed by a token name (e.g. "add PEPE") or by pasting a contract address.
- If they ask about their tokens, reference the watchlist and collected intelligence above.
- If they ask about risks, signals, or red flags, reference the Collected Intelligence section above. Be specific about what was found.
- If signal analysis has been run, mention the risk level and any red flags for relevant tokens.
- If they ask for a report, give a structured summary of each token with risk level, key findings, and red flags.
- When discussing risks, present facts from the data. Do not speculate beyond the evidence.
- Never give financial advice or tell users to buy/sell. You can share factual info about tokens.
- Do not use emoji.`;

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

function addTokenToWatchlist(userId: string, token: Token): void {
  const existing = db.getWatchlist(userId);
  const tokens = existing ? [...existing.tokens] : [];

  // Avoid duplicates
  const alreadyExists = tokens.some(
    (t) =>
      t.contract_address.toLowerCase() ===
      token.contract_address.toLowerCase()
  );

  if (!alreadyExists) {
    tokens.push(token);
    db.setWatchlist(userId, tokens);
  }
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

        case "add_token": {
          const input = msg.content.trim();

          // Try to extract a 0x address from anywhere in the message
          const addressMatch = input.match(/0x[a-fA-F0-9]{40}/);

          if (addressMatch) {
            const contractAddr = addressMatch[0];
            console.log(`Adding token by contract address: ${contractAddr}`);
            await msg.reply("Looking up that contract address...");

            const metadata = await getTokenMetadata(contractAddr);
            const token: Token = {
              contract_address: contractAddr.toLowerCase(),
              token_name: metadata?.name || "Unknown Token",
              symbol: metadata?.symbol || contractAddr.substring(0, 8),
              balance: 0,
              official_twitter: metadata?.twitter_handle
                ? `https://twitter.com/${metadata.twitter_handle}`
                : undefined,
              telegram_group: metadata?.telegram_url
                ? `https://t.me/${metadata.telegram_url}`
                : undefined,
              website:
                metadata?.homepage?.[0] ||
                metadata?.website_url ||
                undefined,
              coingecko_id: metadata?.coingecko_id,
            };

            addTokenToWatchlist(userId, token);
            await msg.reply(
              `Added ${token.symbol} (${token.token_name}) to your watchlist. Say 'scan' to check for red flags.`
            );
            break;
          }

          // Otherwise it's "add <name>" or "track <name>" or "watch <name>"
          const query = input
            .replace(/^(add|track|watch)\s+/i, "")
            .trim();

          if (!query) {
            await msg.reply(
              "What token do you want to add? Send a name (e.g. 'add PEPE') or paste a contract address."
            );
            break;
          }

          console.log(`Searching CoinGecko for: "${query}"`);
          await msg.reply(`Searching for "${query}"...`);

          const result = await searchToken(query);

          if (!result) {
            await msg.reply(
              `Could not find a token matching "${query}". Try the exact ticker symbol or paste the contract address.`
            );
            break;
          }

          // Get the Ethereum contract address from platforms
          const ethAddress =
            result.platforms["ethereum"] || result.platforms[""] || "";

          if (!ethAddress) {
            await msg.reply(
              `Found ${result.symbol} (${result.name}) but it does not have an Ethereum contract address. Only Ethereum mainnet tokens are supported.`
            );
            break;
          }

          const token: Token = {
            contract_address: ethAddress.toLowerCase(),
            token_name: result.name,
            symbol: result.symbol,
            balance: 0,
            coingecko_id: result.id,
          };

          addTokenToWatchlist(userId, token);

          const rankInfo = result.market_cap_rank
            ? ` (rank #${result.market_cap_rank})`
            : "";
          await msg.reply(
            `Added ${token.symbol} (${token.token_name})${rankInfo} to your watchlist. Say 'scan' to check for red flags or 'add' another token.`
          );
          break;
        }

        case "generate_watchlist": {
          const user = db.getUser(userId);
          if (!user || !user.wallet_address) {
            await msg.reply(
              "No wallet linked. You can still add tokens manually - say 'add' followed by a token name (e.g. 'add PEPE') or paste a contract address."
            );
            break;
          }

          console.log(
            `Generating watchlist for user ${userId}, wallet: ${user.wallet_address}`
          );
          await msg.reply("Scanning your wallet for tokens...");

          const tokens = await getTokens(user.wallet_address);

          // Merge with existing watchlist instead of replacing
          const existing = db.getWatchlist(userId);
          const existingAddresses = new Set(
            (existing?.tokens || []).map((t) =>
              t.contract_address.toLowerCase()
            )
          );

          let newCount = 0;
          for (const token of tokens) {
            if (
              !existingAddresses.has(
                token.contract_address.toLowerCase()
              )
            ) {
              addTokenToWatchlist(userId, token);
              newCount++;
            }
          }

          const watchlist = db.getWatchlist(userId);
          const total = watchlist?.tokens.length || 0;

          if (tokens.length === 0 && total === 0) {
            await msg.reply(
              "No tokens found in your wallet. You can add tokens manually - say 'add' followed by a token name or paste a contract address."
            );
            break;
          }

          if (tokens.length === 0) {
            await msg.reply(
              `No new tokens found in your wallet, but you have ${total} tokens in your watchlist already. Say 'scan' to check for red flags.`
            );
            break;
          }

          const lines = tokens.map(
            (t) =>
              `${t.symbol} (${t.token_name}): ${t.balance.toFixed(4)}`
          );
          await msg.reply(
            `Found ${tokens.length} tokens in your wallet (${newCount} new):\n\n${lines.join("\n")}\n\nCollecting project data in the background. Say 'scan' when ready to check for red flags.`
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
              "Your watchlist is empty. Say 'add' followed by a token name (e.g. 'add PEPE') or paste a contract address to start tracking."
            );
            break;
          }

          const lines = watchlist.tokens.map((t) => {
            const balancePart =
              t.balance > 0 ? ` - ${t.balance.toFixed(4)}` : "";
            return `${t.symbol} (${t.token_name})${balancePart}`;
          });
          await msg.reply(
            `Your watchlist (${watchlist.tokens.length} tokens):\n\n${lines.join("\n")}`
          );
          break;
        }

        case "scan_signals": {
          const watchlist = db.getWatchlist(userId);
          if (!watchlist || watchlist.tokens.length === 0) {
            await msg.reply(
              "Your watchlist is empty. Add tokens first by saying 'add' followed by a token name or paste a contract address."
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
            const analyzed = intelEntries.filter(
              (i) => i.signals
            ).length;
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
            await msg.reply(
              "No tokens in your watchlist. Add some first by saying 'add' followed by a token name."
            );
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
        "Something went wrong. Try again or say 'add' followed by a token name to start."
      );
    }
  });
}
