// /functions/api/travel-safety.js  (Cloudflare Pages Functions)

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") || "Turkey").trim();

  // --- CORS ---
  const baseHeaders = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",              // tighten if you want
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: baseHeaders });
  }

  // --- Edge cache (24h) ---
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    // Add a header so you can see hits in DevTools
    const h = new Headers(cached.headers);
    h.set("x-cache", "HIT");
    return new Response(cached.body, { headers: h, status: cached.status });
  }

  // Helper: call OpenAI with retry (429/5xx)
  async function callOpenAIWithRetry(prompt, { retries = 3, model = "gpt-4o-mini" } = {}) {
    let lastErr = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: prompt,
            temperature: 0.2
          }),
          // Avoid long hangs on the edge
          cf: { fetchMetadata: { destination: "empty" } }
        });

        // Successful path
        if (r.ok) {
          const data = await r.json();
          return { ok: true, status: r.status, data, model };
        }

        // Retry on rate limit or transient server errors
        if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
          lastErr = { status: r.status, text: await safeText(r) };
          // Exponential backoff (e.g., 400ms, 900ms, 1600ms)
          const delay = 400 + attempt * 500 + Math.floor(Math.random() * 200);
          await sleep(delay);
          continue;
        }

        // Non-retryable error
        return { ok: false, status: r.status, data: await r.json().catch(() => null) };
      } catch (e) {
        lastErr = e;
        const delay = 400 + attempt * 500 + Math.floor(Math.random() * 200);
        await sleep(delay);
      }
    }

    return { ok: false, status: 429, data: { error: String(lastErr) } };
  }

  const prompt = `Provide concise, bullet-style travel & safety info for ${country}.
Return strict JSON with keys:
  country, updated_at, visa[], laws[], safety[], emergency[], health[], disclaimer.
Each list item must be a short sentence fragment. No markdown or HTML.`;

  try {
    const aiResp = await callOpenAIWithRetry(prompt, { retries: 3 });

    let payload;
    let cacheable = true;

    if (aiResp.ok) {
      const text = aiResp?.data?.output?.[0]?.content?.[0]?.text?.trim() ?? "{}";

      // Attempt to parse model output strictly
      try {
        const parsed = JSON.parse(text);
        payload = {
          ...parsed,
          source: "ai",
          model: aiResp.model,
          updated_at: parsed.updated_at || new Date().toISOString()
        };
      } catch {
        // If model returned non-JSON, surface a friendly fallback
        payload = {
          country,
          updated_at: new Date().toISOString(),
          visa: null,
          laws: null,
          safety: null,
          emergency: null,
          health: null,
          disclaimer: null,
          source: "fallback",
          model: aiResp.model,
          ai_note: "We couldn’t parse AI advice right now. Showing standard guidance.",
        };
        cacheable = false; // don’t cache parse failures
      }
    } else {
      // Friendly fallback on rate limit / errors
      payload = {
        country,
        updated_at: new Date().toISOString(),
        visa: null,
        laws: null,
        safety: null,
        emergency: null,
        health: null,
        disclaimer: null,
        source: "fallback",
        model: "gpt-4o-mini",
        openai_status: aiResp.status,
        ai_note:
          aiResp.status === 429
            ? "AI is temporarily busy (rate limited). Please try again shortly."
            : "AI service is temporarily unavailable. Please try again soon."
      };

      // Cache brief fallback to avoid hammering (5 minutes)
      const shortHeaders = withCacheHeaders(baseHeaders, { sMaxAge: 300 });
      const resp = new Response(JSON.stringify(payload), { headers: shortHeaders, status: 200 });
      await cache.put(cacheKey, resp.clone());
      return resp;
    }

    // Success (or soft fallback). Cache for 24h unless we flagged it non-cacheable.
    const respHeaders = withCacheHeaders(baseHeaders, { sMaxAge: cacheable ? 86400 : 300 });
    const resp = new Response(JSON.stringify(payload), { headers: respHeaders, status: 200 });
    await cache.put(cacheKey, resp.clone());
    return resp;
  } catch (err) {
    const resp = new Response(
      JSON.stringify({ error: String(err), source: "server" }),
      { headers: baseHeaders, status: 500 }
    );
    return resp;
  }
};

/* ---------------- helpers ---------------- */

function withCacheHeaders(h, { sMaxAge = 0 } = {}) {
  const headers = new Headers(h);
  if (sMaxAge > 0) {
    headers.set("cache-control", `public, s-maxage=${sMaxAge}, stale-while-revalidate=600`);
  } else {
    headers.set("cache-control", "no-store");
  }
  return headers;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function safeText(r) {
  try { return await r.text(); } catch { return ""; }
}
