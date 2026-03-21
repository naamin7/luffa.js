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

const users = new Map<string, User>();
const watchlists = new Map<string, Watchlist>();

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
};
