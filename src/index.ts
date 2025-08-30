// src/index.ts   (or functions/api/travel-safety.ts if you use Pages Functions)
export interface Env {
  OPENAI_API_KEY: string;   // set this in Cloudflare → Workers → Settings → Variables
  MODEL?: string;           // optional override, e.g. "gpt-4o-mini" or "gpt-4.1-mini"
}

const CORS = {
  "Access-Control-Allow-Origin": "*",              // or your exact origin
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8",
};

function ok(data: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, ...extra } });
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: CORS,
  });
}

async function getBasics(code: string) {
  const r = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!r.ok) throw new Error(`RestCountries HTTP ${r.status}`);
  const [c] = await r.json();

  return {
    officialName: c?.name?.official ?? "—",
    capital: c?.capital?.[0] ?? "—",
    region: c?.region ?? "—",
    subregion: c?.subregion ?? "",
    languages: c?.languages ? Object.values(c.languages).join(", ") : "—",
    currency: c?.currencies ? Object.keys(c.currencies)[0] : "—",
    callingCode: c?.idd?.root ? c.idd.root + (c.idd.suffixes?.[0] ?? "") : "—",
  };
}

function extractJson(text: string) {
  // Try plain JSON first
  try { return JSON.parse(text); } catch {}
  // Try fenced code block
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  // Try a looser brace slice
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function getAdvice(env: Env, countryLabel: string) {
  // choose model (low cost fast)
  const model = env.MODEL || "gpt-4o-mini";

  const prompt = `
Return STRICT JSON (no commentary) for travel to "${countryLabel}" with this shape:

{
  "visa": [ "bullet", ... 4-6 total ],
  "laws": [ "bullet", ... ],
  "safety": [ "bullet", ... ],
  "health": [ "bullet", ... ],
  "emergency_numbers": { "police": "string", "ambulance": "string", "fire": "string", "notes": ["optional", ...] }
}

Guidelines:
- Keep bullets short, clear, up-to-date.
- If a field is unknown, provide a sensible generic but truthful note (e.g. "Dial 112 across EU").
- Use strings only. No markdown. No prose outside JSON.
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}`);
  }

  const data = await res.json();

  // The Responses API returns output in a structured array; pick the first text
  const text =
    data?.output?.[0]?.content?.[0]?.text ??
    data?.choices?.[0]?.message?.content ?? // fallback if using chat-like models
    "";

  const parsed = extractJson(text);
  if (!parsed) throw new Error("AI did not return valid JSON");

  return { model, advice: parsed };
}

export default {
  async fetch(request: Request, env: Env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== "GET") {
      return err(405, "Use GET or OPTIONS");
    }

    const url = new URL(request.url);
    const code = (url.searchParams.get("country") || "FR").toUpperCase();

    try {
      const basics = await getBasics(code);

      // For a friendly label, use official name (front-end can already map)
      const label = basics.officialName || code;

      let model = "";
      let advice: any = null;
      try {
        const ai = await getAdvice(env, label);
        advice = ai.advice;
        model = ai.model;
      } catch (e) {
        // AI failure is OK – we still return basics
        advice = null;
      }

      return ok({
        country: code,
        code,
        updated_at: new Date().toISOString(),
        basics,
        advice,
        source: advice ? "ai" : "fallback",
        model: advice ? model : undefined,
      });
    } catch (e: any) {
      return err(500, e?.message || "Server error");
    }
  },
};
