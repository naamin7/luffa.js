import { Router } from 'express';
import { db } from '../db';
import { generateWatchlistForUser } from './generateWatchlist';
import { client } from '../bot'; 
// the above is the import the running client

const router = Router();

router.post('/', async (req, res) => { 
  const { user_id, address } = req.body;
  if (!user_id || !address) return res.status(400).json({ error: 'Missing fields' });

  db.setUser(user_id, { wallet_address: address });
  await generateWatchlistForUser(user_id);

  const channel = db.getChannel(user_id);
  if (channel) {
    await client.sendMessage(channel.channelId, channel.isGroup,
      "✅ Wallet connected. Your portfolio is now being tracked."
    );
  }

  res.json({ success: true });
});

export default router;