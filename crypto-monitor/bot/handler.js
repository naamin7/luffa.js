"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const client_1 = require("./client");
const intent_1 = require("./intent");
const db_1 = require("../db");
function registerHandlers() {
    client_1.luffaClient.onMessage(async (msg) => {
        const userId = msg.authorId;
        // Always store channel context 
        db_1.db.setUser(userId, {
            user_id: userId,
            channelId: msg.channelId,
            isGroup: msg.isGroup,
        });
        const intent = (0, intent_1.detectIntent)(msg.content);
        if (intent === 'connect_wallet') {
            const connectUrl = `${process.env.APP_URL}/connect-wallet?user_id=${userId}`;
            if (msg.isGroup) {
                await msg.reply({
                    text: "Import your portfolio automatically.\n\nClick below to connect your wallet:",
                    buttons: [
                        { label: "🔗 Connect Wallet", value: connectUrl }
                    ],
                    dismissType: "select"
                });
            }
            else {
                // error handling 
                await msg.reply(`Import your portfolio automatically.\n\nConnect your wallet here:\n${connectUrl}`);
            }
            return;
        }
        if (intent === 'unknown') {
            await msg.reply("Say 'connect wallet' to link your portfolio and start tracking tokens.");
            return;
        }
        // For all other messages (non-connect commands), show a fixed reply.
        await msg.reply("Say 'connect wallet' to link your portfolio and start tracking tokens.");
    });
}
