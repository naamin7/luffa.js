"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectIntent = detectIntent;
function detectIntent(text) {
    const normalized = (text || '').toLowerCase();
    if (normalized.includes('connect wallet') || normalized.includes('wallet connect')) {
        return 'connect_wallet';
    }
    return 'unknown';
}
