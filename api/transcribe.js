import OpenAI from "openai";
import formidable from 'formidable';
import fs from 'fs';

// Turn off body parsing by Next.js so formidable can handle the multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "Missing GROQ_API_KEY" });
  }

  try {
    const form = formidable({ 
       maxFileSize: 10 * 1024 * 1024, // 10 MB limit
       keepExtensions: true,
    });
    
    // Parse the incoming multipart form data
    const [fields, files] = await form.parse(req);
    
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!audioFile) {
       return res.status(400).json({ error: "No audio file provided in the form data under the 'audio' key." });
    }

    // OpenAI Node SDK handles the Groq Whisper endpoint nicely since Groq is OpenAI-compatible
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    // We must pass a File-like object (ReadStream works) to the SDK
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioFile.filepath),
      model: "whisper-large-v3",
      response_format: "verbose_json", // We need verbose to get duration if available
      language: "en", // Hardcode to English for now as this is an English language tutor
    });

    // Clean up temp file created by formidable
    fs.unlink(audioFile.filepath, (err) => {
       if (err) console.error("Failed to delete temp audio file:", err);
    });

    return res.status(200).json({
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration || 0,
      confidence: 0.9 // Whisper API doesn't always provide a stable global confidence score
    });

  } catch (err) {
    console.error("Transcription API Error:", err);
    const message = err?.message || String(err);
    return res.status(500).json({ error: `Transcription failed: ${message}` });
  }
}
