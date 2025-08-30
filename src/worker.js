const ALLOWED_ORIGINS = new Set([
  "https://porposetarget25.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

async function aiSummarizeCountry(env, basics) {
  // Guard: if no key, return null so the client falls back gracefully.
  if (!env.OPENAI_API_KEY) return null;

  const model = "gpt-4o-mini";
  const schema = {
    type: "object",
    properties: {
      visa: { type: "array", items: { type: "string" } },
      laws: { type: "array", items: { type: "string" } },
      safety: { type: "array", items: { type: "string" } },
      health: { type: "array", items: { type: "string" } },
      emergency_numbers: {
        type: "object",
        properties: {
          police: { type: "string" },
          ambulance: { type: "string" },
          fire: { type: "string" },
          notes: { type: "array", items: { type: "string" } }
        },
        required: ["police","ambulance","fire"],
        additionalProperties: false
      }
    },
    required: ["visa","laws","safety","health","emergency_numbers"],
    additionalProperties: false
  };

  const user = `
You are helping a travel app. Create concise, practical bullet points (<=6 each).
Country: ${basics.officialName} (${basics.code})
Region: ${basics.region} — ${basics.subregion || "—"}
Capital: ${basics.capital}
Languages: ${basics.languages}
Currency: ${basics.currency}
Dial code: ${basics.callingCode}

Return JSON ONLY matching the given schema. Do not add extra keys.
Keep items short, plain, and non-alarmist. If a field is uncertain, use "Check locally".
`;

  const body = {
    model,
    response_format: { type: "json_schema", json_schema: { name: "travel_safety", schema } },
    messages: [
      { role: "system", content: "You are a precise travel assistant. You must return the requested JSON only." },
      { role: "user", content: user }
    ]
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) return null;
  const data = await res.json();
  // get the JSON content the model produced
  const text = data.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/api/travel-safety") {
      const code = (url.searchParams.get("country") || "").toUpperCase();
      if (!code) {
        return new Response(JSON.stringify({ error: "country is required" }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      // basic country facts from RestCountries
      const rc = await fetch(`https://restcountries.com/v3.1/alpha/${code}`);
      if (!rc.ok) {
        return new Response(JSON.stringify({ error: `RestCountries ${rc.status}` }), {
          status: rc.status, headers: { ...headers, "Content-Type": "application/json" }
        });
      }
      const arr = await rc.json();
      const c = Array.isArray(arr) ? arr[0] : arr;

      const basics = {
        code,
        officialName: c?.name?.official || "—",
        capital: (c?.capital && c.capital[0]) || "—",
        region: c?.region || "—",
        subregion: c?.subregion || "",
        languages: c?.languages ? Object.values(c.languages).join(", ") : "—",
        currency: c?.currencies ? Object.keys(c.currencies)[0] : "—",
        callingCode:
          c?.idd?.root
            ? c.idd.root + ((c.idd.suffixes && c.idd.suffixes[0]) || "")
            : "—"
      };

      // cache result for 6h based on country
      const cacheKey = new Request(url.toString(), request);
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) {
        return new Response(cached.body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
      }

      // ask OpenAI for the 5 sections
      const advice = await aiSummarizeCountry(env, basics);

      const payload = {
        country: c?.name?.common || basics.officialName || code,
        code,
        updated_at: new Date().toISOString(),
        basics,
        advice // may be null if OpenAI call failed
      };

      const resp = new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "public, max-age=0" }
      });

      // store in edge cache for 6 hours
      resp.headers.set("CF-Cache-Status", "MISS");
      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=21600" }
      })));

      return resp;
    }

    return new Response("Not found", { status: 404, headers });
  }
};
