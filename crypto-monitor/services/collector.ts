import { db, TokenIntel } from "../db";
import { Token } from "./alchemy";
import { getTokenMetadata } from "./coingecko";
import { scrapeWebsite } from "./scraper";

const CACHE_TTL_MS = 30 * 60 * 1000;

export async function collectIntelForUser(userId: string): Promise<void> {
  const watchlist = db.getWatchlist(userId);
  if (!watchlist || watchlist.tokens.length === 0) return;

  db.setCollectionStatus(userId, {
    user_id: userId,
    last_collected_at: Date.now(),
    token_count: watchlist.tokens.length,
    status: "collecting",
  });

  try {
    for (const token of watchlist.tokens) {
      const existing = db.getTokenIntel(token.contract_address);
      if (existing && Date.now() - existing.collected_at < CACHE_TTL_MS) {
        continue;
      }

      await collectSingleToken(token);
    }

    db.setCollectionStatus(userId, {
      user_id: userId,
      last_collected_at: Date.now(),
      token_count: watchlist.tokens.length,
      status: "complete",
    });
  } catch (err) {
    console.error("Collection failed:", err);
    db.setCollectionStatus(userId, {
      user_id: userId,
      last_collected_at: Date.now(),
      token_count: watchlist.tokens.length,
      status: "error",
      error_message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

async function collectSingleToken(token: Token): Promise<void> {
  const intel: TokenIntel = {
    contract_address: token.contract_address,
    collected_at: Date.now(),
  };

  console.log(`Collecting intel for ${token.symbol} (${token.contract_address})...`);

  const cgData = await getTokenMetadata(token.contract_address);

  if (cgData) {
    intel.coingecko_data = {
      coingecko_id: cgData.coingecko_id,
      description: cgData.description.substring(0, 1000),
      market_cap_rank: cgData.market_cap_rank,
      twitter_handle: cgData.twitter_handle,
      telegram_url: cgData.telegram_url,
      website_url: cgData.website_url,
      last_updated: cgData.last_updated,
    };

    token.official_twitter = cgData.twitter_handle
      ? `https://twitter.com/${cgData.twitter_handle}`
      : undefined;
    token.telegram_group = cgData.telegram_url
      ? `https://t.me/${cgData.telegram_url}`
      : undefined;
    token.website = cgData.homepage?.[0] || cgData.website_url || undefined;
    token.coingecko_id = cgData.coingecko_id;
    token.aliases = [cgData.symbol, cgData.name].filter(Boolean);

    if (token.website) {
      console.log(`Scraping website for ${token.symbol}: ${token.website}`);
      intel.website_text = (await scrapeWebsite(token.website)) || undefined;
    }

    const parts: string[] = [];
    if (cgData.community_data?.twitter_followers) {
      parts.push(
        `Twitter followers: ${cgData.community_data.twitter_followers.toLocaleString()}`
      );
    }
    if (cgData.community_data?.telegram_channel_user_count) {
      parts.push(
        `Telegram members: ${cgData.community_data.telegram_channel_user_count.toLocaleString()}`
      );
    }
    if (cgData.market_cap_rank) {
      parts.push(`Market cap rank: #${cgData.market_cap_rank}`);
    }
    intel.social_summary = parts.length > 0 ? parts.join(". ") : undefined;

    console.log(`Intel collected for ${token.symbol}: CoinGecko data found`);
  } else {
    console.log(`No CoinGecko data found for ${token.symbol}`);
  }

  db.setTokenIntel(token.contract_address, intel);
}

export function buildIntelContext(userId: string): string {
  const watchlist = db.getWatchlist(userId);
  if (!watchlist || watchlist.tokens.length === 0) return "";

  const intelEntries = db.getAllTokenIntel(
    watchlist.tokens.map((t) => t.contract_address)
  );

  if (intelEntries.length === 0) return "";

  let context = "\n--- Collected Intelligence on Portfolio Tokens ---\n\n";

  for (const intel of intelEntries) {
    const token = watchlist.tokens.find(
      (t) =>
        t.contract_address.toLowerCase() ===
        intel.contract_address.toLowerCase()
    );
    const name = token
      ? `${token.symbol} (${token.token_name})`
      : intel.contract_address;

    context += `[${name}]\n`;

    if (intel.coingecko_data) {
      const cg = intel.coingecko_data;
      if (cg.description) context += `Description: ${cg.description}\n`;
      if (cg.market_cap_rank)
        context += `Market Cap Rank: #${cg.market_cap_rank}\n`;
      if (cg.twitter_handle) context += `Twitter: @${cg.twitter_handle}\n`;
      if (cg.telegram_url) context += `Telegram: ${cg.telegram_url}\n`;
      if (cg.website_url) context += `Website: ${cg.website_url}\n`;
    }

    if (intel.social_summary) {
      context += `Social: ${intel.social_summary}\n`;
    }

    if (intel.website_text) {
      context += `Website Content: ${intel.website_text.substring(0, 500)}\n`;
    }

    if (intel.signals) {
      const s = intel.signals;
      context += `Risk Assessment: ${s.risk_level.toUpperCase()}\n`;
      if (s.red_flags.length > 0) {
        context += `Red Flags: ${s.red_flags.join("; ")}\n`;
      }
      context += `Analysis: ${s.summary}\n`;
      if (s.key_findings.length > 0) {
        context += `Key Findings: ${s.key_findings.join("; ")}\n`;
      }
    }

    context += "\n";
  }

  return context;
}
