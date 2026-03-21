"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("../bot/client");
const handler_1 = require("../bot/handler");
(0, handler_1.registerHandlers)();
client_1.luffaClient.start().then(() => {
    console.log('Crypto monitor bot started, polling...');
}).catch(console.error);
