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

  const { topic } = req.body || {};
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  const COUNT = 5;
  const safeTopic = topic.trim().slice(0, 200);

  const prompt = `あなたは日本の中学数学の教師です。中学生(中1〜中3)の受験基礎トレーニング用に、次のトピックに関する基礎〜標準レベルの計算・文章題を${COUNT}問作成してください。
トピック: 「${safeTopic}」

出力は必ず次のJSON配列の形式のみで、それ以外の文章(説明・前置き・コードブロックの記号)は一切含めないでください。
[
  {"q":"問題文", "a":"簡潔な答え", "e":"簡潔な解説(1〜2文)"},
  ...
]
条件:
- 問題文・答え・解説はすべて日本語。
- 数式の累乗は x² のように上付き文字を使う。分数はできるだけ簡単な形(例: 3/4)で表す。
- 中学生が自力で20分程度のドリルの一部として解けるレベルの難易度にする(難問すぎないこと)。
- 改行が必要な場合は問題文中に \\n を使ってよい。
- 必ずちょうど${COUNT}問作成すること。
- 出題範囲は日本の中学校学習指導要領(中1〜中3)の範囲内に厳密に限定すること。判別式、三角比(sin/cos/tan)、微分・積分、数列、複素数、行列、対数など高校数学の内容は絶対に出題しないこと(二次方程式の解の公式自体は中3範囲なので使用可)。トピックが高校以上の内容を指す場合は、それに最も近い中学範囲の内容に読み替えて出題すること。`;

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
    console.error('generate-topic handler error', err);
    res.status(500).json({ error: 'リクエストに失敗しました: ' + (err && err.message ? err.message : String(err)) });
  }
}
