const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SummaryRequest = {
  kind?: string;
  handle?: string;
  copy?: string;
  eventDate?: string;
  sourceHref?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") return part.text;
    }
  }
  return "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeTweetUrl(value: string) {
  const raw = String(value || "").trim().replace(/[)\]>,.!?]+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    if (parsed.hostname === "mobile.x.com") parsed.hostname = "x.com";
    if (parsed.hostname === "mobile.twitter.com") parsed.hostname = "twitter.com";
    return parsed.toString();
  } catch {
    return raw;
  }
}

function isUrlOnly(value: string) {
  return /^https?:\/\/\S+$/i.test(String(value || "").trim());
}

async function fetchTweetFromOembed(sourceHref: string) {
  const url = canonicalizeTweetUrl(sourceHref);
  if (!url) return null;
  const response = await fetch(`https://publish.x.com/oembed?omit_script=1&lang=en&url=${encodeURIComponent(url)}`);
  if (!response.ok) return null;
  const payload = await response.json();
  const html = String(payload?.html || "");
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
  const links = Array.from(html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi));
  const dateText = links.length ? decodeHtml(links[links.length - 1][1] || "") : "";
  const parsedDate = dateText ? new Date(dateText) : null;
  return {
    copy: decodeHtml(paragraph),
    eventDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : "",
    handle: String(payload?.author_name || "").trim().replace(/^@/, ""),
    sourceHref: canonicalizeTweetUrl(String(payload?.url || url)),
  };
}

function normalizeSummary(value: any) {
  const title = String(value?.title || "").replace(/\s+/g, " ").trim();
  const copy = String(value?.copy || "").replace(/\s+/g, " ").trim();
  const tags = Array.isArray(value?.tags)
    ? value.tags
        .map((tag: unknown) => String(tag || "").trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  return { title, copy, tags };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 500);
  }

  let body: SummaryRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const kind = body.kind === "guardian" ? "guardian" : "fud";
  let handle = String(body.handle || "").trim();
  let eventDate = String(body.eventDate || "").trim();
  let sourceHref = canonicalizeTweetUrl(String(body.sourceHref || "").trim());
  let tweet = String(body.copy || "").replace(/\s+/g, " ").trim();
  if ((!tweet || isUrlOnly(tweet)) && sourceHref) {
    const fetched = await fetchTweetFromOembed(sourceHref);
    if (fetched?.copy) {
      tweet = fetched.copy;
      handle = handle || fetched.handle;
      eventDate = eventDate || fetched.eventDate;
      sourceHref = fetched.sourceHref || sourceHref;
    }
  }
  if (!tweet) {
    return jsonResponse({ error: "Tweet copy is required" }, 400);
  }

  const modeGuidance = kind === "guardian"
    ? "Make this a Guardian receipt: preserve bullish or constructive intent, make it concise, credible, and community-focused."
    : "Make this a FUD receipt: summarize the bearish criticism plainly, with the same concise curated tone as the existing finance FUD entries.";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.5",
      input: [
        {
          role: "system",
          content: [
            "You create short finance timeline receipt entries for finance.trollrunner.net.",
            "Return only JSON with title, copy, and tags.",
            "Title format must be '<handle>: <short headline>' when a handle exists.",
            "Copy should be one concise paragraph, paraphrasing the tweet in the style of existing curated entries.",
            "Tags must be 2 to 4 short lowercase slug strings.",
            "Do not add facts that are not present in the tweet.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            mode: kind,
            guidance: modeGuidance,
            handle,
            eventDate,
            sourceHref,
            tweet,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "finance_tweet_summary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "copy", "tags"],
            properties: {
              title: { type: "string" },
              copy: { type: "string" },
              tags: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: { type: "string" },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    return jsonResponse({ error: await response.text() }, response.status);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);
  try {
    const summary = normalizeSummary(JSON.parse(outputText));
    if (!summary.title || !summary.copy || !summary.tags.length) {
      return jsonResponse({ error: "AI response was incomplete" }, 502);
    }
    return jsonResponse(summary);
  } catch {
    return jsonResponse({ error: "AI response was not valid JSON" }, 502);
  }
});
