import { Router, Request, Response } from "express";
import { db } from "../db";
import { Token, getTokens } from "../services/alchemy";
import { searchToken, getTokenMetadata } from "../services/coingecko";

const router = Router();

router.post("/link-wallet", (req: Request, res: Response) => {
  const { user_id, address } = req.body;

  if (!user_id || !address) {
    res.status(400).json({ error: "user_id and address are required" });
    return;
  }

  const ethAddressPattern = /^0x[a-fA-F0-9]{40}$/;
  if (!ethAddressPattern.test(address)) {
    res.status(400).json({ error: "Invalid Ethereum address" });
    return;
  }

  db.setUser(user_id, { wallet_address: address.toLowerCase() });

  res.json({ success: true });
});

router.post(
  "/add-token",
  async (req: Request, res: Response): Promise<void> => {
    const { user_id, query, contract_address } = req.body;

    if (!user_id) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }

    if (!query && !contract_address) {
      res
        .status(400)
        .json({ error: "Provide either query (token name) or contract_address" });
      return;
    }

    try {
      let token: Token;

      if (contract_address) {
        const ethAddressPattern = /^0x[a-fA-F0-9]{40}$/;
        if (!ethAddressPattern.test(contract_address)) {
          res.status(400).json({ error: "Invalid contract address" });
          return;
        }

        const metadata = await getTokenMetadata(contract_address);
        token = {
          contract_address: contract_address.toLowerCase(),
          token_name: metadata?.name || "Unknown Token",
          symbol: metadata?.symbol || contract_address.substring(0, 8),
          balance: 0,
          coingecko_id: metadata?.coingecko_id,
        };
      } else {
        const result = await searchToken(query);
        if (!result) {
          res
            .status(404)
            .json({ error: `No token found matching "${query}"` });
          return;
        }

        const ethAddress =
          result.platforms["ethereum"] || result.platforms[""] || "";
        if (!ethAddress) {
          res.status(404).json({
            error: `${result.symbol} (${result.name}) has no Ethereum contract address`,
          });
          return;
        }

        token = {
          contract_address: ethAddress.toLowerCase(),
          token_name: result.name,
          symbol: result.symbol,
          balance: 0,
          coingecko_id: result.id,
        };
      }

      // Add to watchlist (avoid duplicates)
      const existing = db.getWatchlist(user_id);
      const tokens = existing ? [...existing.tokens] : [];
      const alreadyExists = tokens.some(
        (t) =>
          t.contract_address.toLowerCase() ===
          token.contract_address.toLowerCase()
      );

      if (!alreadyExists) {
        tokens.push(token);
        db.setWatchlist(user_id, tokens);
      }

      res.json({ success: true, token });
    } catch (err) {
      console.error("Failed to add token:", err);
      res.status(500).json({ error: "Failed to add token" });
    }
  }
);

router.post(
  "/generate-watchlist",
  async (req: Request, res: Response): Promise<void> => {
    const { user_id } = req.body;

    if (!user_id) {
      res.status(400).json({ error: "user_id is required" });
      return;
    }

    const user = db.getUser(user_id);
    if (!user || !user.wallet_address) {
      res.status(404).json({ error: "User not found. Link a wallet first." });
      return;
    }

    try {
      const tokens = await getTokens(user.wallet_address);

      // Merge with existing watchlist
      const existing = db.getWatchlist(user_id);
      const allTokens = existing ? [...existing.tokens] : [];
      const existingAddresses = new Set(
        allTokens.map((t) => t.contract_address.toLowerCase())
      );

      for (const token of tokens) {
        if (!existingAddresses.has(token.contract_address.toLowerCase())) {
          allTokens.push(token);
        }
      }

      db.setWatchlist(user_id, allTokens);

      res.json({
        success: true,
        token_count: allTokens.length,
        new_from_wallet: tokens.length,
        tokens: allTokens,
      });
    } catch (err) {
      console.error("Failed to generate watchlist:", err);
      res.status(500).json({ error: "Failed to fetch tokens from Alchemy" });
    }
  }
);

router.get("/watchlist", (req: Request, res: Response) => {
  const user_id = req.query.user_id as string;

  if (!user_id) {
    res.status(400).json({ error: "user_id query param is required" });
    return;
  }

  const watchlist = db.getWatchlist(user_id);

  if (!watchlist) {
    res.json({ tokens: [] });
    return;
  }

  res.json({ tokens: watchlist.tokens });
});

router.get("/config", (_req: Request, res: Response) => {
  res.json({
    walletconnect_project_id: process.env.WALLETCONNECT_PROJECT_ID || "",
  });
});

export default router;
