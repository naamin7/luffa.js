import { Token } from "./services/alchemy";

export interface User {
  user_id: string;
  wallet_address?: string;
  channelId?: string;
  isGroup?: boolean;
}

export interface Watchlist {
  user_id: string;
  tokens: Token[];
}

export interface SignalReport {
  analyzed_at: number;
  risk_level: "low" | "medium" | "high" | "critical";
  red_flags: string[];
  summary: string;
  key_findings: string[];
}

export interface TokenIntel {
  contract_address: string;
  collected_at: number;
  coingecko_data?: {
    coingecko_id: string;
    description: string;
    market_cap_rank: number | null;
    twitter_handle: string | null;
    telegram_url: string | null;
    website_url: string | null;
    last_updated: string;
  };
  website_text?: string;
  social_summary?: string;
  signals?: SignalReport;
}

export interface CollectionStatus {
  user_id: string;
  last_collected_at: number;
  token_count: number;
  status: "idle" | "collecting" | "complete" | "error";
  error_message?: string;
}

const users = new Map<string, User>();
const watchlists = new Map<string, Watchlist>();
const tokenIntel = new Map<string, TokenIntel>();
const collectionStatus = new Map<string, CollectionStatus>();

export const db = {
  setUser: (user_id: string, data: Partial<User>) => {
    const existing = users.get(user_id) || { user_id };
    users.set(user_id, { ...existing, ...data });
  },
  getUser: (user_id: string) => users.get(user_id),
  setWatchlist: (user_id: string, tokens: Token[]) => {
    watchlists.set(user_id, { user_id, tokens });
  },
  getWatchlist: (user_id: string) => watchlists.get(user_id),

  setTokenIntel: (contract_address: string, data: TokenIntel) => {
    tokenIntel.set(contract_address.toLowerCase(), data);
  },
  getTokenIntel: (contract_address: string) =>
    tokenIntel.get(contract_address.toLowerCase()),
  getAllTokenIntel: (contract_addresses: string[]) => {
    return contract_addresses
      .map((addr) => tokenIntel.get(addr.toLowerCase()))
      .filter((t): t is TokenIntel => t !== undefined);
  },

  setCollectionStatus: (user_id: string, status: CollectionStatus) => {
    collectionStatus.set(user_id, status);
  },
  getCollectionStatus: (user_id: string) => collectionStatus.get(user_id),
};
