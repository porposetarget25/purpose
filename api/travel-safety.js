// api/travel-safety.js  (Vercel/Netlify compatible)
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 24h cache headers (CDN can cache public responses per country)
const oneDay = 60 * 60 * 24;

export default async function handler(req, res) {
  try {
    const country = (req.query.country || "").trim();
    if (!country) {
      return res.status(400).json({ error: "Missing ?country=" });
    }

    // Guardrail: short country name only
    if (country.length > 50) {
      return res.status(400).json({ error: "Country name too long" });
    }

    // A strict schema we want the model to fill
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        country: { type: "string" },
        updated_at: { type: "string" },
        visa: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
        laws: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
        safety: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
        emergency: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
        health: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
        disclaimer: { type: "string" }
      },
      required: ["country","updated_at","visa","laws","safety","emergency","health","disclaimer"]
    };

    // Prompt: ask for concise, practical bullets with a clear disclaimer.
    const system = `
You are a concise "Travel & Safety" assistant.
Return practical, current-seeming guidance in bullet points that travelers can act on.
Never give legal advice; always add a disclaimer to verify with official sources.
If uncertain, say "Check current official guidance".
Keep everything neutral and respectful.`;

    const user = `
Country: ${country}

Return JSON ONLY, matching the given JSON schema (no extra keys).
Bullet points should be short, concrete and specific (no fluff).
Include emergency numbers **only** if they are well-known nation-wide numbers (otherwise say "Check local emergency numbers").
`;

    // If your SDK supports response_format JSON schema, use it:
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or your preferred model
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "TravelSafety", schema } }
    });

    const text = response.choices[0]?.message?.content || "{}";
    // Basic safety parse
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!data || !data.country) {
      return res.status(502).json({ error: "Model returned invalid JSON" });
    }

    // Add a simple server-side cache header
    res.setHeader("Cache-Control", `public, s-maxage=${oneDay}, stale-while-revalidate=${oneDay}`);
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
