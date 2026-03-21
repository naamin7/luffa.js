export function detectIntent(text: string): 'connect_wallet' | 'unknown' {
  const normalized = (text || '').toLowerCase();

  if (normalized.includes('connect wallet') || normalized.includes('wallet connect')) {
    return 'connect_wallet';
  }

  return 'unknown';
}
