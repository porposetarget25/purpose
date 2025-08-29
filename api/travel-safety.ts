import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // set to your GH pages origin if you want

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const country = String(req.query.country || '').trim();
    if (!country) return res.status(400).json({ error: 'country is required' });
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    // Build the system+user prompt (short, factual, globally useful)
    const messages = [
      {
        role: "system",
        content:
          "You are a travel-safety assistant. Be concise, neutral, and practical. " +
          "Return ONLY valid JSON that conforms exactly to the provided schema. " +
          "Prefer globally applicable advice and include ‘official sources vary; verify before travel’ in disclaimer."
      },
      {
        role: "user",
        content:
`Country: ${country}
Return a JSON object with this schema:
{
  "country": string,
  "updated_at": string, // ISO date
  "visa": string[],     // 3-7 bullets
  "laws": string[],     // 3-7 bullets
  "safety": string[],   // 3-7 bullets (include common scams to avoid)
  "emergency": string[],// 3-6 bullets (include Police/Ambulance/Fire if known or how to reach)
  "health": string[],   // 3-7 bullets (vaccines, water, hospitals)
  "disclaimer": string  // 1 sentence, include 'verify with official sources'
}`
      }
    ];

    // Call OpenAI
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "OpenAI error", details: text });
    }

    const data = await r.json();
    let content = data.choices?.[0]?.message?.content || "";
    // Safety net: try to parse JSON; if the model wrapped in code fences, strip them
    content = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    let json: any;
    try { json = JSON.parse(content); }
    catch { return res.status(502).json({ error: "Bad JSON from model", content }); }

    // normalize + add timestamp if missing
    json.country = json.country || country;
    json.updated_at = json.updated_at || new Date().toISOString();

    // cache-friendly headers (optional)
    res.setHeader('Cache-Control', 'public, s-maxage=21600, max-age=3600'); // edge 6h, browser 1h
    return res.status(200).json(json);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
