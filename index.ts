export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return handleOptions(req);
    }

    try {
      if (url.pathname === "/api/travel-safety") {
        const country = url.searchParams.get("country") || "TR";

        // TODO: your existing logic to build the JSON payload
        // e.g. call OpenAI / RestCountries / merge data, etc.
        const data = {
          country,
            updated_at: new Date().toISOString(),
            visa, laws, safety, emergency, health,
            source: "ai",
            model: "gpt-4o-mini",
          disclaimer:
            "Info can change. Verify with official sources before you travel."
        };

        return json(data, req);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders(req) });
    } catch (err) {
      return json({ error: "Internal error", detail: String(err) }, req, 500);
    }
  }
}

/* ---------- helpers ---------- */

function corsHeaders(req) {
  // reflect the origin so it works for both localhost and GitHub Pages
  const origin = req.headers.get("Origin") || "*";

  // If you want to allow only specific origins, do:
  // const allowlist = new Set(["http://127.0.0.1:5500", "https://porposetarget25.github.io"]);
  // const origin = allowlist.has(req.headers.get("Origin")) ? req.headers.get("Origin") : "https://porposetarget25.github.io";

  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    // only include this if you ever use cookies/credentials:
    // "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function handleOptions(req) {
  // Preflight response
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req)
  });
}

function json(payload, req, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders(req)
  });
}
