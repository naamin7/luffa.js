import { Router, Request, Response } from "express";
import { db } from "../db";
import { getTokens } from "../services/alchemy";

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
      db.setWatchlist(user_id, tokens);

      res.json({
        success: true,
        token_count: tokens.length,
        tokens,
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
