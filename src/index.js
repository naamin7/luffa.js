export { Client } from "./client/Client.js";
export { SoftFailError } from "./errors/SoftFailError.js";
export { LuffaAPIError } from "./errors/LuffaAPIError.js";
export { Message } from "./structures/Message.js";
export * as Constants from "./util/constants.js";
//<<<<<<< HEAD

import { Client } from "luffa.js";

const client = new Client({
  secret: "your_robot_secret",
  pollInterval: 1000 // ms, optional
});

client.onMessage(async (message) => {
  console.log(`${message.authorId}: ${message.content}`);
  
  // Reply to messages
  await message.reply("Thanks for your message!");
});

// Start the client
await client.start();


//hello all

//>>>>>>> abb1caa1125e1cf816a376cbe8e32f3ea8376193