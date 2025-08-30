// src/worker.ts (or index.ts)
export default {
  async fetch(req: Request, env: { OPENAI_API_KEY: string }) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/travel-safety") {
      return new Response("Not found", { status: 404 });
    }

    const country = url.searchParams.get("country") ?? "Turkey";
    const prompt = `
Return concise travel info for ${country} as JSON with keys:
country, updated_at, visa[], laws[], safety[], emergency[], health[], disclaimer.
Keep each bullet short and factual.
`;

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a precise travel-safety assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ error: `OpenAI error: ${r.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await r.json();
    // expect JSON in assistant message
    const text = data.choices?.[0]?.message?.content ?? "{}";
    return new Response(text, { headers: { "Content-Type": "application/json" } });
  }
};
