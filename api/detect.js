export default async function handler(req, res) {
  // 1. 僅允許 POST 請求
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  // 2. 獲取 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY 未在 Vercel 環境變數中設定。" });
  }

  const { image } = req.body;
  
  // 基礎連接測試
  if (!image) return res.status(200).json({ status: "Gemini Paid Tier Backend Ready" });

  try {
    /**
     * 修復 400 錯誤：
     * 在 v1 正式版 API 中，參數應使用駝峰式命名 (camelCase)，即 responseMimeType。
     * 我們依然使用 gemini-1.5-flash，這是付費帳戶最穩定的選擇。
     */
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
          // 修正為 v1 標準參數名
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    });

    const data = await response.json();
    
    // 3. 處理錯誤響應
    if (data.error) { 
      console.error("Google API 錯誤詳情:", data.error);
      
      return res.status(data.error.code || 500).json({ 
        error: "Gemini API 請求失敗", 
        message: data.error.message,
        details: data.error.status,
        code: data.error.code
      });
    }

    // 4. 提取並解析結果
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 清理可能存在的 Markdown 標籤
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsedData = JSON.parse(resultText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("JSON 解析失敗。原始文字:", resultText);
      res.status(500).json({ error: "AI 回傳格式非合法 JSON，請重試。" });
    }

  } catch (error) {
    console.error("伺服器內部錯誤:", error);
    res.status(500).json({ error: "後端處理出錯: " + error.message });
  }
}
