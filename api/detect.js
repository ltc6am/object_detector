export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return res.status(500).json({ error: "API Key 缺失，请检查环境变量。" });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(200).json({ status: "Ready" });
  }

  try {
    // 方案 D 优化点 1：虽然已经是 flash，但我们可以通过配置 response_mime_type 
    // 强制模型输出 JSON，这样会减少模型推理的开销，降低被限流的概率。
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects. Return JSON array: [{name, description, box_2d: [ymin, xmin, ymax, xmax]}]. Scale: 0-1000." },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }],
        // 强制要求 JSON 输出，提高稳定性
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    // 方案 D 优化点 2：直接检查响应状态码
    if (response.status === 429) {
      return res.status(429).json({ 
        error: "请求太频繁了（免费额度限制）。请等待约 30-60 秒后再试。" 
      });
    }

    const data = await response.json();

    if (data.error) {
      // 针对具体的 Google 错误代码进行分类处理
      const statusCode = data.error.code || 500;
      const message = statusCode === 429 ? "API 额度已达上限，请稍后再试。" : data.error.message;
      return res.status(statusCode).json({ error: message });
    }

    // 解析结果
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // 剥离可能存在的 markdown
    if (resultText.includes("```")) {
      const match = resultText.match(/\[[\s\S]*\]/);
      if (match) resultText = match[0];
    }

    try {
      const parsedData = JSON.parse(resultText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      res.status(500).json({ error: "AI 响应格式解析失败，请重试。" });
    }

  } catch (error) {
    console.error("Critical Backend Error:", error);
    res.status(500).json({ error: "服务器内部错误: " + error.message });
  }
}
