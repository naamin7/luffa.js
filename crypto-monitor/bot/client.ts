import dotenv from "dotenv";
dotenv.config(); // ✅ load .env FIRST

import { Client } from "luffa.js";

const client = new Client({ secret: process.env.LUFFA_SECRET });

export default client;