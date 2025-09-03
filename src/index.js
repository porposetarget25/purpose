// index.js — Cloudflare Worker (ESM)

// ---------- CORS ----------
const CORS = {
  "Access-Control-Allow-Origin": "*", // or lock to your site
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8",
};

const ok  = (data, extraHeaders = {}) =>
  new Response(JSON.stringify(data), { headers: { ...CORS, ...extraHeaders } });

const bad = (status, message, meta) =>
  new Response(JSON.stringify({ error: message, meta }), { status, headers: CORS });

// ---------- Worker entry ----------
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const codeParam = url.searchParams.get("country") ?? url.searchParams.get("code");
    const code = (codeParam || "").trim().toUpperCase();
    if (!code) return bad(400, "Missing ?country=CC (ISO alpha-2)");

    // 1) Country basics (non-AI)
    let basics, label = code;
    try {
      basics = await getBasics(code);
      label = basics.officialName || code;
    } catch (e) {
      return bad(502, "Failed to fetch country basics", { reason: String(e) });
    }

    // 2) AI advice (retry + cache)
    let advice = null;
    let aiMeta = {};

    const cacheKey = new Request(`https://cache.local/travel-advice/${encodeURIComponent(code)}`);
    const cache = caches.default;

    // Try cache first
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const j = await cached.json();
        advice = j?.advice ?? null;
        aiMeta = { source: "ai_cache", cached_at: j?.cached_at };
      }
    } catch (_) {}

    // If no cache, call OpenAI with retry
    if (!advice) {
      try {
        const model = env.MODEL || "gpt-4o-mini";
        const ai = await getAdviceWithRetry(env, model, label);
        advice = ai.parsed;
        aiMeta = { source: ai.source, model: ai.model, openai_status: ai.status };

        // Cache successful advice for 24h
        if (advice) {
          await cache.put(
            cacheKey,
            new Response(JSON.stringify({ advice, cached_at: new Date().toISOString() }), {
              headers: { "Cache-Control": "public, max-age=86400" },
            })
          );
        }
      } catch (e) {
        aiMeta = { source: "ai_error", error: String(e) };
      }
    }

    // 3) Compose response
    return ok({
      country: label,
      code,
      updated_at: new Date().toISOString(),
      basics,
      advice,                 // object or null
      ...aiMeta               // metadata for UI (source/model/status/cached_at)
    });
  }
};

// ---------- Helpers ----------

// Country quick facts from RestCountries (edge cached)
async function getBasics(code) {
  const r = await fetch(
    `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`,
    { cf: { cacheTtl: 3600, cacheEverything: true } }
  );
  if (!r.ok) throw new Error(`RestCountries HTTP ${r.status}`);
  const [c] = await r.json();
  return {
    code,
    officialName: c?.name?.official ?? "—",
    capital:      c?.capital?.[0]   ?? "—",
    region:       c?.region         ?? "—",
    subregion:    c?.subregion      ?? "",
    languages:    c?.languages ? Object.values(c.languages).join(", ") : "—",
    currency:     c?.currencies ? Object.keys(c.currencies)[0] : "—",
    callingCode:  c?.idd?.root ? c.idd.root + (c.idd.suffixes?.[0] ?? "") : "—"
  };
}

// Extract JSON from model output safely
function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
  return null;
}

// Read response text without throwing
async function safeText(res) {
  try { return await res.text(); } catch { return "<no-body>"; }
}

// OpenAI call with exponential backoff + jitter, honoring Retry-After
async function getAdviceWithRetry(env, model, countryLabel, maxRetries = 4) {
  if (!env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const system = "You are a travel assistant. Output ONLY JSON, no prose.";
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
Keep bullets short and factual. If unsure, include a cautious generic note.
Output ONLY JSON.
`.trim();

  let lastStatus = 0;

  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user",   content: prompt }
        ],
        temperature: 0.2,
        max_output_tokens: 900
      }),
    });

    lastStatus = res.status;

    if (res.ok) {
      const data   = await res.json();
      const rawOut = data.output_text
          ?? data.output?.[0]?.content?.[0]?.text
          ?? data.choices?.[0]?.message?.content
          ?? "";
      const parsed = rawOut ? extractJson(String(rawOut)) : null;
      return { parsed, source: "ai", model, status: res.status };
    }

    // Retry only on 429 or 5xx
    if ((res.status === 429 || res.status >= 500) && i < maxRetries - 1) {
      const ra = Number(res.headers.get("retry-after-sometime"));
      const backoff = ra ? ra * 1000 : (2 ** i) * 1000 + Math.floor(Math.random() * 200);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    // Non-retryable or last attempt
    const body = await safeText(res);
    return { parsed: null, source: "ai", model, status: res.status, raw: body };
  }

  return { parsed: null, source: "ai", model, status: lastStatus || 520 };
}
