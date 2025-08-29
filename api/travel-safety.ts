// api/travel-safety.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_ORIGINS = [
  // Add your GitHub Pages domain here for best security, e.g.:
  // 'https://yourname.github.io',
];

function corsHeaders(origin?: string) {
  // Allow your pages host if specified, otherwise fall back to wildcard
  const allowOrigin =
    (origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Origin', corsHeaders(origin)['Access-Control-Allow-Origin']);
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const countryRaw = (req.query.country as string | undefined) || '';
  const country = countryRaw.trim();
  if (!country) {
    res.setHeader('Access-Control-Allow-Origin', corsHeaders(origin)['Access-Control-Allow-Origin']);
    return res.status(400).json({ error: 'Missing ?country=COUNTRY_NAME' });
  }

  try {
    // Generate JSON with a fixed shape. We do NOT claim legal certainty.
    const system = `
You are a careful travel assistant. Output concise, practical advice for travelers.
Do not fabricate specific legal details if unsure; prefer neutral wording like "Check official source" or "See local number".
Keep tone clear and non-alarmist. Avoid long paragraphs. Use up-to-date general knowledge only.
Always return strict JSON matching the schema with arrays of short bullet points.
`;

    const user = `
Return a JSON object with this exact shape:

{
  "country": string,
  "updated_at": ISO8601 date string (UTC),
  "visa": string[] (3-6 concise bullets),
  "laws": string[] (3-6 concise bullets),
  "safety": string[] (3-6 concise bullets),
  "emergency": string[] (police/ambulance/fire numbers or how to reach them; 2-4 bullets),
  "health": string[] (vaccines, hospitals, water safety; 3-6 bullets),
  "disclaimer": string (one sentence reminding to verify with official sources)
}

The country is: "${country}".

Formatting rules:
- No markdown. JSON only.
- Each bullet point should be one sentence, practical and clear.
- If you are not confident in a specific number (e.g., an emergency code), write "See official number" or "Dial the local emergency number".
`;

    const response = await client.chat.completions.create({
      // "gpt-4o-mini" is fast & inexpensive; adjust if you prefer a different model
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const jsonText = response.choices?.[0]?.message?.content || '{}';
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch {
      // Fallback shape if model ever returns malformed JSON
      data = {
        country,
        updated_at: new Date().toISOString(),
        visa: ['Check official sources for latest visa rules.'],
        laws: ['Follow local regulations and cultural norms.'],
        safety: ['Stay aware of surroundings and avoid isolated areas at night.'],
        emergency: ['Dial the local emergency number or contact nearest police station.'],
        health: ['Consult a travel clinic for recommended vaccines.'],
        disclaimer: 'This is general guidance; verify details with official sources before you travel.',
      };
    }

    // Minimal shape guard
    data.country = data.country || country;
    data.updated_at = data.updated_at || new Date().toISOString();

    // CORS + caching
    const headers = {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      // Cache at the edge for 24h, allow SWR
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
      Vary: 'Origin',
    };
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v as string));

    return res.status(200).send(JSON.stringify(data));
  } catch (err: any) {
    console.error('travel-safety error:', err);
    res.setHeader('Access-Control-Allow-Origin', corsHeaders(origin)['Access-Control-Allow-Origin']);
    return res.status(500).json({ error: 'Failed to fetch travel & safety info.' });
  }
}
