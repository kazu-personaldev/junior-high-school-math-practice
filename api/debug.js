export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  const info = { hasKey: !!apiKey, keyLength: apiKey ? apiKey.length : 0 };

  if (!apiKey) {
    res.status(200).json(info);
    return;
  }

  try {
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly one word: hello' }] }] })
      }
    );
    const text = await r.text();
    info.geminiStatus = r.status;
    info.geminiBodySnippet = text.slice(0, 800);
  } catch (e) {
    info.thrownError = e && e.message ? e.message : String(e);
  }

  res.status(200).json(info);
}
