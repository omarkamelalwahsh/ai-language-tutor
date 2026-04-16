from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings
from groq import AsyncGroq
import os
import shutil
import tempfile

router = APIRouter()

# Initialize Groq client
client = AsyncGroq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not client:
        raise HTTPException(status_code=503, detail="Groq API key missing on server")

    # Save uploaded file to a temporary location
    try:
        suffix = os.path.splitext(file.filename)[1] or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                transcript = await client.audio.transcriptions.create(
                    file=(file.filename, audio_file.read()),
                    model="whisper-large-v3",
                    language="en",
                    response_format="json",
                )
            
            return {"text": transcript.text}
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
