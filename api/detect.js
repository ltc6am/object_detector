export default async function handler(req, res) {
  // 1. 检查请求方法
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // 2. 检查 API Key
  // 注意：请确保在 Vercel Project Settings -> Environment Variables 中
  // 添加了名为 GEMINI_API_KEY 的变量
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    console.error("Error: GEMINI_API_KEY is not defined in environment variables.");
    return res.status(500).json({ 
      error: "Server configuration error: API Key is missing. Please check Vercel Environment Variables." 
    });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(200).json({ status: "Backend is online and ready for image data." });
  }

  try {
    // 使用目前最快且稳定的 gemini-2.0-flash 模型
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects in this image. Return a clean JSON array of objects. Each object must have 'name' (string), 'description' (string), and 'box_2d' (array [ymin, xmin, ymax, xmax] using 0-1000 scale). Return ONLY the JSON array, no extra conversational text or markdown code blocks." },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();

    // 3. 处理 Google API 返回的错误
    if (data.error) {
      console.error("Google Gemini API Error Detail:", data.error);
      return res.status(data.error.code || 500).json({ error: data.error.message });
    }

    // 4. 解析 AI 返回的文本
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 鲁棒性处理：如果 AI 返回了 Markdown 格式 (```json ... ```)，将其剥离
    if (resultText.includes("```")) {
      const match = resultText.match(/\[[\s\S]*\]/);
      if (match) {
        resultText = match[0];
      }
    }

    try {
      const parsedData = JSON.parse(resultText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("JSON Parsing Error:", resultText);
      res.status(500).json({ error: "AI returned an invalid data format. Please try again." });
    }

  } catch (error) {
    console.error("Critical Backend Error:", error);
    res.status(500).json({ error: "Server crashed during processing: " + error.message });
  }
}
