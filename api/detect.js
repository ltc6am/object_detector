export default async function handler(req, res) {
  // 1. 仅允许 POST 请求
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  // 2. 获取 API Key (优先使用 GEMINI_API_KEY)
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel environment variables." });
  }

  const { image } = req.body;

  // 3. 用于测试连接的响应
  if (!image) return res.status(200).json({ status: "Gemini Backend Ready" });

  try {
    // 修复：将模型名更新为更具体的 'gemini-1.5-flash-latest' 以确保 v1beta 路径兼容性
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects in this image. Return ONLY a JSON array of objects with 'name', 'description', and 'box_2d' [ymin, xmin, ymax, xmax]. Use 0-1000 for coordinates. Do not include markdown formatting like ```json." },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();
    
    // 4. 处理 Google API 返回的错误
    if (data.error) {
      // 针对 "model not found" 错误提供更清晰的提示
      if (data.error.status === "NOT_FOUND") {
        throw new Error("Model path issue. Tried gemini-1.5-flash-latest but it failed. Please check your API key region permissions.");
      }
      throw new Error(data.error.message || "Gemini API returned an error");
    }

    // 5. 提取并清洗 AI 返回的文本
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 移除可能存在的 Markdown 代码块标记
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    // 6. 尝试解析 JSON 并返回
    try {
      const parsedData = JSON.parse(resultText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", resultText);
      res.status(500).json({ error: "AI returned invalid JSON format. Please try again." });
    }

  } catch (error) {
    console.error("Backend processing error:", error);
    res.status(500).json({ error: "Gemini Processing Failed: " + error.message });
  }
}
