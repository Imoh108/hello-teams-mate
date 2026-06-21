// Server-only Firecrawl scrape helper. Uses the Lovable connector gateway so
// the FIRECRAWL_API_KEY never reaches the browser.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl";

export async function scrapeUrlMarkdown(url: string, maxChars = 12_000): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!firecrawlKey)
    throw new Error("Firecrawl is not connected. Link the Firecrawl connector in workspace settings.");

  const res = await fetch(`${GATEWAY_URL}/v2/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": firecrawlKey,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl scrape failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json: any = await res.json().catch(() => ({}));
  // v2 SDK shape: { success, data: { markdown, metadata } }
  const markdown: string | undefined =
    json?.data?.markdown ?? json?.markdown ?? json?.data?.content;
  if (!markdown || markdown.trim().length < 50) {
    throw new Error("Firecrawl returned no readable content for this URL.");
  }
  return markdown.slice(0, maxChars);
}
