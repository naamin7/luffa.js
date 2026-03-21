"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const users = new Map();
const watchlists = new Map();
exports.db = {
    setUser: (user_id, data) => {
        const existing = users.get(user_id) || { user_id };
        users.set(user_id, { ...existing, ...data });
    },
    getUser: (user_id) => users.get(user_id),
    setWatchlist: (user_id, tokens) => {
        watchlists.set(user_id, { user_id, tokens });
    },
    getWatchlist: (user_id) => watchlists.get(user_id),
};
