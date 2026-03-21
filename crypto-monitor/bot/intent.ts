export type Intent =
  | "connect_wallet"
  | "link_address"
  | "add_token"
  | "generate_watchlist"
  | "get_watchlist"
  | "scan_signals"
  | "token_report"
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

  // Standalone contract address -> add it to watchlist directly
  if (/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    return "add_token";
  }

  // "add <something>" or "track <something>" or "watch <something>"
  if (
    normalized.startsWith("add ") ||
    normalized.startsWith("track ") ||
    normalized.startsWith("watch ")
  ) {
    return "add_token";
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

  if (
    normalized.includes("scan") ||
    normalized.includes("check risks") ||
    normalized.includes("red flags") ||
    normalized.includes("analyze") ||
    normalized.includes("signals")
  ) {
    return "scan_signals";
  }

  if (
    normalized.includes("report") ||
    normalized.includes("intel") ||
    normalized.includes("research") ||
    normalized.includes("tell me about")
  ) {
    return "token_report";
  }

  return "unknown";
}
