// /functions/api/travel-safety.js (Pages Functions)
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const country = url.searchParams.get("country") || "Turkey";

  // CORS (adjust origins as needed)
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // Call OpenAI from the server side
    const prompt = `Provide concise, bullet-style travel & safety info for ${country}.
Return JSON with keys: country, updated_at, visa[], laws[], safety[], emergency[], health[], disclaimer.
Keep each item short; never include HTML.`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        temperature: 0.2
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `OpenAI ${r.status}`, details: t }), { status: 502, headers });
    }

    const data = await r.json();

    // The Responses API returns { output: [{ content: [{ type:"output_text", text:"..." }] }], ... }
    const text = data?.output?.[0]?.content?.[0]?.text?.trim() ?? "{}";

    // Try to parse JSON from the model; if it’s not valid, wrap it.
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = { country, updated_at: new Date().toISOString(), raw: text }; }

    return new Response(JSON.stringify(payload), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
};
