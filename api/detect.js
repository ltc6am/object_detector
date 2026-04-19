export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  // 请确保在 Vercel 中把 GEMINI_API_KEY 换成你的 DeepSeek Key
  // 或者新建一个环境变量叫 DEEPSEEK_API_KEY
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY;
  const { image } = req.body;

  if (!image) return res.status(200).json({ status: "DeepSeek Backend Ready" });

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 或者 deepseek-reasoner
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify objects in this image. Return ONLY a JSON array of objects with 'name', 'description', and 'box_2d' [ymin, xmin, ymax, xmax]. Use 0-1000 for coordinates." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    const resultText = data.choices[0].message.content;
    res.status(200).json(JSON.parse(resultText));

  } catch (error) {
    res.status(500).json({ error: "DeepSeek Processing Failed: " + error.message });
  }
}
