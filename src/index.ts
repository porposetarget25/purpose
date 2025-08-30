/**
 * Cloudflare Worker / Pages Function
 * Route: /api/travel-safety?country=FR
 */
export interface Env {
  OPENAI_API_KEY: string;       // set in Cloudflare → Workers → Settings → Variables
  MODEL?: string;               // optional, e.g. "gpt-4.1-mini" (default "gpt-4o-mini")
}

const CORS = {
  "Access-Control-Allow-Origin": "*",           // or lock to your GitHub Pages origin
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8",
};

const ok = (data: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { headers: { ...CORS, ...extra } });

const bad = (status: number, message: string, meta?: unknown) =>
  new Response(JSON.stringify({ error: message, meta }), { status, headers: CORS });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    // Support both /api/travel-safety and ?country=FR
    const codeParam = url.searchParams.get("country") ?? url.searchParams.get("code");
    const code = (codeParam || "").trim().toUpperCase();
    if (!code) return bad(400, "Missing ?country=CC (ISO alpha-2)");

    // 1) basics (RestCountries)
    let basics;
    let label = code;
    try {
      basics = await getBasics(code);
      // Use official name for the prompt; fall back to code.
      label = basics.officialName || code;
    } catch (e: any) {
      return bad(502, "Failed to fetch country basics", { reason: String(e) });
    }

    // 2) advice (OpenAI)
    let advice: any = null;
    let aiMeta: any = {};
    try {
      const model = env.MODEL || "gpt-4o-mini";
      const ai = await getAdvice(env, model, label);
      advice = ai.parsed;                    // may be null if parsing failed
      aiMeta = { source: ai.source, model: ai.model, openai_status: ai.status };
    } catch (e: any) {
      // We still return basics; client will fall back to generic bullets.
      aiMeta = { source: "ai_error", error: String(e) };
    }

    return ok({
      country: label,
      code,
      updated_at: new Date().toISOString(),
      basics,
      advice,                // object or null
      ...aiMeta
    });
  }
} satisfies ExportedHandler<Env>;

/* ---------- helpers ---------- */

async function getBasics(code: string) {
  const r = await fetch(
    `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`,
    { cf: { cacheTtl: 3600, cacheEverything: true } }
  );
  if (!r.ok) throw new Error(`RestCountries HTTP ${r.status}`);
  const [c] = await r.json();

  return {
    code,
    officialName: c?.name?.official ?? "—",
    capital: c?.capital?.[0] ?? "—",
    region: c?.region ?? "—",
    subregion: c?.subregion ?? "",
    languages: c?.languages ? Object.values(c.languages).join(", ") : "—",
    currency: c?.currencies ? Object.keys(c.currencies)[0] : "—",
    callingCode: c?.idd?.root ? c.idd.root + (c.idd.suffixes?.[0] ?? "") : "—",
  };
}

// Extract JSON from plain text, fenced code, or loose braces
function extractJson(text: string) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
  return null;
}

async function getAdvice(env: Env, model: string, countryLabel: string) {
  if (!env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const system = `You are a travel assistant. Output ONLY JSON, no prose.`;
  const prompt = `
Return STRICT JSON for travel to "${countryLabel}" with shape:

{
  "visa": ["bullet", ...],
  "laws": ["bullet", ...],
  "safety": ["bullet", ...],
  "health": ["bullet", ...],
  "emergency_numbers": {
    "police": "string",
    "ambulance": "string",
    "fire": "string",
    "notes": ["optional", ...]
  }
}

Keep bullets short and factual. If you're unsure, include a cautious generic note.
Output ONLY JSON.
`.trim();

  // Use the Responses API (works well on Workers)
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.2,
      max_output_tokens: 900
    })
  });

  if (!res.ok) {
    const text = await safeText(res);
    return { parsed: null, source: "ai", model, status: res.status, raw: text };
  }

  const data = await res.json();

  // Try multiple shapes from /v1/responses
  const rawText =
    data.output_text ??
    data.output?.[0]?.content?.[0]?.text ??
    data.choices?.[0]?.message?.content ??
    typeof data === "string" ? data : JSON.stringify(data);

  const parsed = rawText ? extractJson(String(rawText)) : null;

  return { parsed, source: "ai", model, status: res.status };
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return "<no-body>"; }
}
