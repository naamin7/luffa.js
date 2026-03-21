"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHandlers = registerHandlers;
const client_1 = require("./client");
const intent_1 = require("./intent");
const db_1 = require("../db");
async function askClaude(prompt) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
        throw new Error('Missing CLAUDE_API_KEY in environment variables');
    }
    const apiUrl = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/complete';
    const model = process.env.CLAUDE_MODEL || 'claude-2.1';
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            prompt: `Human: ${prompt}\n\nAssistant:`,
            max_tokens_to_sample: Number(process.env.CLAUDE_MAX_TOKENS || 500),
            temperature: Number(process.env.CLAUDE_TEMPERATURE || 0.5),
            stop_sequences: ['\n\nHuman:'],
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    return (data.completion || data.completion_text || '').trim() || 'Sorry, I could not generate a response.';
}
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
            // If user message isn't a known command, pass to Claude for an AI-driven reply.
            try {
                const aiReply = await askClaude(msg.content);
                await msg.reply(aiReply);
            }
            catch (err) {
                console.error('Claude reply failed:', err);
                await msg.reply("Say 'connect wallet' to link your portfolio and start tracking tokens.");
            }
            return;
        }
        // For all other messages (non-connect commands), ask Claude too.
        try {
            const aiReply = await askClaude(msg.content);
            await msg.reply(aiReply);
        }
        catch (err) {
            console.error('Claude reply failed:', err);
            await msg.reply("Sorry, I couldn't generate an AI response right now. Please try again later.");
        }
    });
}
