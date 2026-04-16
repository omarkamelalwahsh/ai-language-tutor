from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any
from app.core.config import settings
from groq import AsyncGroq

router = APIRouter()

# Initialize Groq client
client = AsyncGroq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    modelType: Optional[str] = "FAST"
    temperature: Optional[float] = 0.7
    response_format: Optional[Any] = None

@router.post("")
async def chat_proxy(request: ChatRequest):
    if not client:
        raise HTTPException(status_code=503, detail="Groq API key missing on server")

    # Sync model selection with Node.js logic
    model = "llama-3.3-70b-versatile" if request.modelType in ["SMART", "llama-3.3-70b-versatile"] else "llama-3.1-8b-instant"

    try:
        chat_completion = await client.chat.completions.create(
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            model=model,
            temperature=request.temperature,
            response_format=request.response_format if request.response_format else None
        )
        # Return in OpenAI/Groq format to match what frontend expects
        return chat_completion.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
