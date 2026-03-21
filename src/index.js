export { Client } from "./client/Client.js";
export { SoftFailError } from "./errors/SoftFailError.js";
export { LuffaAPIError } from "./errors/LuffaAPIError.js";
export { Message } from "./structures/Message.js";
export * as Constants from "./util/constants.js";
//<<<<<<< HEAD

import { Client } from "luffa.js";

const client = new Client({
  secret: "09c9afa298ff4f9bb115e5d911f4ef3b",
  pollInterval: 1000 // ms, optional
});

client.onMessage(async (message) => {
  console.log(`${message.authorId}: ${message.content}`);
  
  // Reply to messages
  await message.reply("Hi, I'm InvesTrack!");
});

// Start the client
await client.start();


//hello all

//>>>>>>> abb1caa1125e1cf816a376cbe8e32f3ea8376193