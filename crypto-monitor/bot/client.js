"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.luffaClient = void 0;
const luffa_js_1 = require("luffa.js");
exports.luffaClient = new luffa_js_1.Client({
    secret: process.env.LUFFA_SECRET,
    pollInterval: 1000,
});
