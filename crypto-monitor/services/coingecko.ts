import { Token } from "./alchemy";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const RATE_LIMIT_DELAY_MS = 2500;

export interface CoinGeckoTokenData {
  coingecko_id: string;
  name: string;
  symbol: string;
  description: string;
  market_cap_rank: number | null;
  twitter_handle: string | null;
  telegram_url: string | null;
  website_url: string | null;
  homepage: string[];
  last_updated: string;
  community_data: {
    twitter_followers: number | null;
    telegram_channel_user_count: number | null;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTokenMetadata(
  contractAddress: string
): Promise<CoinGeckoTokenData | null> {
  const url = `${COINGECKO_BASE}/coins/ethereum/contract/${contractAddress.toLowerCase()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      return null;
    }

    if (res.status === 429) {
      console.log("CoinGecko rate limited, waiting 60s before retry...");
      await sleep(60_000);
      const retry = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!retry.ok) return null;
      const data = await retry.json();
      return parseResponse(data);
    }

    if (!res.ok) {
      console.error(`CoinGecko returned ${res.status} for ${contractAddress}`);
      return null;
    }

    const data = await res.json();
    return parseResponse(data);
  } catch (err) {
    console.error(`CoinGecko fetch failed for ${contractAddress}:`, err);
    return null;
  }
}

function parseResponse(data: any): CoinGeckoTokenData {
  const links = data.links || {};
  const community = data.community_data || {};

  return {
    coingecko_id: data.id || "",
    name: data.name || "",
    symbol: (data.symbol || "").toUpperCase(),
    description: (data.description?.en || "").substring(0, 1500),
    market_cap_rank: data.market_cap_rank || null,
    twitter_handle: links.twitter_screen_name || null,
    telegram_url: links.telegram_channel_identifier || null,
    website_url: links.homepage?.[0] || null,
    homepage: links.homepage || [],
    last_updated: data.last_updated || "",
    community_data: {
      twitter_followers: community.twitter_followers || null,
      telegram_channel_user_count:
        community.telegram_channel_user_count || null,
    },
  };
}

export async function enrichTokensWithMetadata(
  tokens: Token[]
): Promise<Token[]> {
  for (const token of tokens) {
    const metadata = await getTokenMetadata(token.contract_address);

    if (metadata) {
      token.official_twitter = metadata.twitter_handle
        ? `https://twitter.com/${metadata.twitter_handle}`
        : undefined;
      token.telegram_group = metadata.telegram_url
        ? `https://t.me/${metadata.telegram_url}`
        : undefined;
      token.website =
        metadata.homepage?.[0] || metadata.website_url || undefined;
      token.coingecko_id = metadata.coingecko_id;
      token.aliases = [metadata.symbol, metadata.name].filter(Boolean);
    }

    await sleep(RATE_LIMIT_DELAY_MS);
  }

  return tokens;
}
