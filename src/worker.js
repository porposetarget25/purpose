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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/api/travel-safety") {
      const code = (url.searchParams.get("country") || "").toUpperCase();
      if (!code) {
        return new Response(JSON.stringify({ error: "country is surely required" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      const rc = await fetch(`https://restcountries.com/v3.1/alpha/${code}`);
      if (!rc.ok) {
        return new Response(JSON.stringify({ error: `RestCountries ${rc.status}` }), {
          status: rc.status,
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }
      const data = await rc.json();

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404, headers });
  }
};
