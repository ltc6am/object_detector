export default async function handler(req, res) {
  // 1. 仅允许 POST 请求
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  // 2. 获取 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel environment variables." });
  }

  const { image } = req.body;
  
  // 基础连接测试
  if (!image) return res.status(200).json({ status: "Gemini Backend Ready" });

  try {
    // 使用兼容性最强的模型名称标识符
    // 如果 gemini-2.0-flash 提示找不到，gemini-1.5-flash 是最稳妥的替代方案
    const modelName = "gemini-1.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects in this image. Return a JSON array of objects. Each object must have 'name', 'description', and 'box_2d' [ymin, xmin, ymax, xmax] using 0-1000 scale. Return ONLY the raw JSON array." },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.1
        }
      })
    });

    const data = await response.json();
    
    // 3. 处理错误响应
    if (data.error) {
      console.error("Google API Error:", data.error);
      return res.status(data.error.code || 500).json({ 
        error: "Gemini API Error", 
        message: data.error.message,
        details: data.error.status
      });
    }

    // 4. 解析结果
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 移除可能存在的 Markdown 标签
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsedData = JSON.parse(resultText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("JSON Parsing failed. Raw text:", resultText);
      res.status(500).json({ error: "Failed to parse AI response as JSON." });
    }

  } catch (error) {
    console.error("Critical Server Error:", error);
    res.status(500).json({ error: "Internal Server Error: " + error.message });
  }
}
