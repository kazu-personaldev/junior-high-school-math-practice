export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'サーバーにAPIキーが設定されていません。' });
    return;
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items is required' });
    return;
  }

  const safeItems = items.slice(0, 20).map(it => ({
    grade: (it && it.grade ? String(it.grade) : '').slice(0, 10),
    label: (it && it.label ? String(it.label) : '').slice(0, 60)
  }));

  const list = safeItems.map((it, i) => `${i + 1}. 学年:${it.grade} 分野:「${it.label}」`).join('\n');

  const prompt = `あなたは日本の中学数学の教師です。次の${safeItems.length}個の項目それぞれについて、指定された学年・分野に沿った基礎〜標準レベルの計算・文章題を1問ずつ作成してください。
${list}

出力は必ず次のJSON配列の形式のみで、それ以外の文章(説明・前置き・コードブロックの記号)は一切含めないでください。配列の要素数と順序は上記の項目リストと必ず一致させてください。
[
  {"q":"問題文", "a":"簡潔な答え", "e":"簡潔な解説(1〜2文)"},
  ...
]
条件:
- 問題文・答え・解説はすべて日本語。
- 数式の累乗は x² のように上付き文字を使う。分数はできるだけ簡単な形(例: 3/4)で表す。
- 中学生が自力で20分程度のドリルの一部として解けるレベルの難易度にする(難問すぎないこと)。
- 改行が必要な場合は問題文中に \\n を使ってよい。
- 各項目は指定された学年・分野の内容から絶対に外れないこと。同じ分野が複数回出てきても、できるだけ違う問題にすること。
- 答えの数値・計算は必ず正確であること。`;

  try {
    const geminiResp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    const rawText = await geminiResp.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch (parseErr) { /* leave data null */ }

    if (!geminiResp.ok) {
      console.error('Gemini API error', geminiResp.status, rawText);
      res.status(502).json({ error: data?.error?.message || rawText || 'Gemini API error' });
      return;
    }

    const text = (data?.candidates || [])
      .flatMap(c => c.content?.parts || [])
      .map(p => p.text || '')
      .join('');

    res.status(200).json({ text });
  } catch (err) {
    console.error('generate-variety handler error', err);
    res.status(500).json({ error: 'リクエストに失敗しました: ' + (err && err.message ? err.message : String(err)) });
  }
}
