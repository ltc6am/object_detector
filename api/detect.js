export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not found in Vercel settings' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Identify objects in this image. Return a JSON array: [{\"name\": \"...\", \"description\": \"...\", \"box_2d\": [ymin, xmin, ymax, xmax]}]" },
            { inlineData: { mimeType: "image/png", data: image } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    res.status(200).json(JSON.parse(resultText));
  } catch (error) {
    res.status(500).json({ error: "AI Processing Failed" });
  }
}
