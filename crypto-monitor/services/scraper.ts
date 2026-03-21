import * as cheerio from "cheerio";

const MAX_TEXT_LENGTH = 3000;
const FETCH_TIMEOUT_MS = 8000;

export async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    if (!url || !url.startsWith("http")) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InvesTrack/1.0; +https://investrack.io)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, iframe, noscript").remove();

    let text = "";
    const selectors = ["main", "article", ".content", "#content", "body"];

    for (const selector of selectors) {
      const el = $(selector);
      if (el.length > 0) {
        text = el.text();
        break;
      }
    }

    if (!text) return null;

    text = text
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    if (text.length < 50) return null;

    return text.substring(0, MAX_TEXT_LENGTH);
  } catch (err) {
    return null;
  }
}
