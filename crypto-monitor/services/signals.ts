import Anthropic from "@anthropic-ai/sdk";
import { db, TokenIntel, SignalReport } from "../db";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const RED_FLAG_CRITERIA = `Analyze this token's data for the following red flags:

1. TOKEN MIGRATION RISK: Any mention of token migrations, swaps, or contract changes.
2. TEAM CONCERNS: Signs of admins leaving, negative sentiment about the team, people calling the project a scam, anonymous or unknown main team members.
3. COMMUNICATION GAPS: If the project appears to have gone silent (no recent updates, stale website content, last update dates older than 3 months).
4. CONTRACT RED FLAGS: Any mention of honeypot characteristics, locked liquidity issues, unusual contract settings, or restricted selling.
5. SENTIMENT: Overall negative sentiment from available data, community complaints, or warnings.
6. SOCIAL PRESENCE: Missing or very low social media following relative to claimed market cap.
7. WEBSITE QUALITY: Sparse, broken, or suspicious website content.

For each red flag found, be specific about the evidence.
Assign a risk level: low (0-1 minor flags), medium (2 flags or 1 notable concern), high (3-4 flags), critical (5+ flags or any severe flag like honeypot or confirmed scam).`;

export async function analyzeTokenSignals(
  contractAddress: string
): Promise<SignalReport | null> {
  const intel = db.getTokenIntel(contractAddress);
  if (!intel) return null;

  let dataBlock = "";

  if (intel.coingecko_data) {
    const cg = intel.coingecko_data;
    dataBlock += `Token ID: ${cg.coingecko_id}\n`;
    dataBlock += `Description: ${cg.description}\n`;
    dataBlock += `Market Cap Rank: ${cg.market_cap_rank || "unranked"}\n`;
    dataBlock += `Twitter: ${cg.twitter_handle || "none found"}\n`;
    dataBlock += `Telegram: ${cg.telegram_url || "none found"}\n`;
    dataBlock += `Website: ${cg.website_url || "none found"}\n`;
    dataBlock += `Last Updated: ${cg.last_updated}\n`;
  }

  if (intel.social_summary) {
    dataBlock += `Social Metrics: ${intel.social_summary}\n`;
  }

  if (intel.website_text) {
    dataBlock += `\nScraped Website Content:\n${intel.website_text}\n`;
  }

  if (!dataBlock.trim()) {
    const report: SignalReport = {
      analyzed_at: Date.now(),
      risk_level: "medium",
      red_flags: [
        "No public data found on CoinGecko or official website",
      ],
      summary:
        "This token has no discoverable public information. It may be very new, very small, or potentially suspicious.",
      key_findings: [
        "Not listed on CoinGecko",
        "No scrapeable website found",
      ],
    };
    intel.signals = report;
    db.setTokenIntel(contractAddress, intel);
    return report;
  }

  try {
    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: `You are a crypto token risk analyst. Analyze token data and return a JSON object with exactly these fields:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "red_flags": ["string array of specific flags found"],
  "summary": "2-3 sentence overall assessment",
  "key_findings": ["string array of notable findings, both positive and negative"]
}
Return ONLY valid JSON. No markdown, no explanation, no other text.`,
      messages: [
        {
          role: "user",
          content: `${RED_FLAG_CRITERIA}\n\nToken Data:\n${dataBlock}`,
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") return null;

    const parsed = JSON.parse(block.text);
    const report: SignalReport = {
      analyzed_at: Date.now(),
      risk_level: parsed.risk_level || "medium",
      red_flags: parsed.red_flags || [],
      summary: parsed.summary || "Analysis could not be completed.",
      key_findings: parsed.key_findings || [],
    };

    intel.signals = report;
    db.setTokenIntel(contractAddress, intel);
    return report;
  } catch (err) {
    console.error(`Signal analysis failed for ${contractAddress}:`, err);
    return null;
  }
}

export async function analyzeAllTokenSignals(userId: string): Promise<void> {
  const watchlist = db.getWatchlist(userId);
  if (!watchlist) return;

  for (const token of watchlist.tokens) {
    const intel = db.getTokenIntel(token.contract_address);
    if (intel && !intel.signals) {
      console.log(`Analyzing signals for ${token.symbol}...`);
      await analyzeTokenSignals(token.contract_address);
    }
  }
}
