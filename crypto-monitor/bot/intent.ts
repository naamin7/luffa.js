export type Intent =
  | "connect_wallet"
  | "link_address"
  | "generate_watchlist"
  | "get_watchlist"
  | "unknown";

export function detectIntent(text: string): Intent {
  const normalized = (text || "").toLowerCase().trim();

  if (
    normalized.includes("connect wallet") ||
    normalized.includes("wallet connect") ||
    normalized.includes("link wallet")
  ) {
    return "connect_wallet";
  }

  if (/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    return "link_address";
  }

  if (
    normalized.includes("generate watchlist") ||
    normalized.includes("show my tokens") ||
    normalized.includes("fetch tokens") ||
    normalized.includes("scan wallet") ||
    normalized.includes("my portfolio")
  ) {
    return "generate_watchlist";
  }

  if (
    normalized.includes("my watchlist") ||
    normalized.includes("show watchlist") ||
    normalized.includes("watchlist")
  ) {
    return "get_watchlist";
  }

  return "unknown";
}
