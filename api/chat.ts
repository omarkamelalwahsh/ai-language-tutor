import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // الـ Key هنا مستحيل تظهر لليوزر في المتصفح
  const apiKey = process.env.GROQ_API_KEY; 
  const { messages, modelType } = req.body;

  // Map modelType to Groq model strings, keeping backwards compatibility
  const model = modelType === 'SMART' || modelType === 'llama-3.3-70b-versatile'
    ? "llama-3.3-70b-versatile" 
    : "llama-3.1-8b-instant";

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1, // Fixed for assessment stability
        response_format: { type: "json_object" } // Crucial for parsing
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to connect to Groq" });
  }
}
