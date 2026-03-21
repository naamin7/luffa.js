import { Client } from 'luffa.js';

export const luffaClient = new Client({
  secret: process.env.LUFFA_SECRET!,
  pollInterval: 1000,
});