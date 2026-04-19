export default async function handler(req, res) {
  // 1. 仅允许 POST 请求
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  // 2. 获取 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel environment variables." });
  }

  const { image } = req.body;

  // 3. 用于测试连接的响应
  if (!image) return res.status(200).json({ status: "Gemini 2.0 Backend Ready" });

  try {
    // 使用最新的 Gemini 2.0 Flash 模型
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects in this image. Return a JSON array of objects. Each object must have 'name', 'description', and 'box_2d' [ymin, xmin, ymax, xmax] using 0-1000 scale. Return ONLY the JSON." },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    const data = await response.json();
    
    // 4. 处理 Google API 返回的错误
    if (data.error) {
      const errMsg = data.error.message || "";
      
      // 针对地区/位置错误的拦截
      if (errMsg.includes("location") || data.error.status === "PERMISSION_DENIED") {
        return res.status(403).json({ 
          error: "Region Restriction: Google API does not support your current Vercel Server location.",
          solution: "Please go to Vercel Settings -> Functions -> Function Region and change it to 'Washington, D.C. (iad1)'. Then Redeploy."
        });
      }
      throw new Error(errMsg || "Gemini API returned an error");
    }

    // 5. 提取并清洗 AI 返回的文本
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 鲁棒的清理逻辑：通过正则匹配提取第一个 [ 到最后一个 ] 之间的内容
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }

    // 6. 尝试解析 JSON 并返回
    try {
      const parsedData = JSON.parse(resultText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse JSON. Raw output:", resultText);
      res.status(500).json({ 
        error: "AI Response Parsing Failed",
        details: "The AI did not return a valid JSON array. Check Vercel logs for raw output."
      });
    }

  } catch (error) {
    console.error("Backend processing error:", error);
    res.status(500).json({ error: "Gemini Processing Failed: " + error.message });
  }
}
