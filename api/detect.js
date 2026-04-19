export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API Key is missing in Vercel Environment Variables" });

  const { image } = req.body;
  if (!image) return res.status(200).json({ status: "Backend is online, waiting for image" });

  try {
    // 使用更稳定的 gemini-2.0-flash
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects in this image. Return a clean JSON array of objects. Each object must have 'name' (string), 'description' (string), and 'box_2d' (array [ymin, xmin, ymax, xmax] using 0-1000 scale). Return ONLY the JSON array, no extra text." },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();

    // 处理 API 返回的错误
    if (data.error) {
      console.error("Gemini API Error Detail:", data.error);
      return res.status(data.error.code || 500).json({ error: data.error.message });
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 鲁棒的 JSON 提取逻辑：去除 Markdown 格式
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }

    const parsedData = JSON.parse(resultText);
    res.status(200).json(parsedData);

  } catch (error) {
    console.error("Critical Backend Error:", error);
    res.status(500).json({ error: "AI Processing Failed: " + error.message });
  }
}
