import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Method Restriction
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Variable Validation
  const apiKey = process.env.GROQ_API_KEY; 
  if (!apiKey) {
    console.error("[Backend] GROQ_API_KEY is missing in environment variables.");
    return res.status(500).json({ error: "API configuration error on server." });
  }

  const { messages, modelType, temperature, response_format } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array in request body." });
  }

  // 3. Model Mapping
  const model = modelType === 'SMART' || modelType === 'llama-3.3-70b-versatile'
    ? "llama-3.3-70b-versatile" 
    : "llama-3.1-8b-instant";

  try {
    console.log(`[Backend] Forwarding to Groq: ${model} (Messages: ${messages.length})`);

    const body: any = {
      model,
      messages,
      temperature: temperature || 0.1,
    };

    if (response_format) {
      body.response_format = response_format;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Backend] Groq API returned error:", data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("[Backend] Runtime Error:", error.message);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
}
