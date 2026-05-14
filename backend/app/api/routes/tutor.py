import logging
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from groq import AsyncGroq

from app.api.deps import get_current_user_id
from app.db.database import get_db
from app.core.config import settings
from app.models.domain import ChatHistory, LearnerProfile

logger = logging.getLogger(__name__)
router = APIRouter()

# Dedicated Groq client for the tutor (uses task engine key for separation)
tutor_client = AsyncGroq(api_key=settings.GROQ_TASK_ENGINE_API_KEY or settings.GROQ_API_KEY)
TUTOR_MODEL = "llama-3.3-70b-versatile"

# ---------------------------------------------------------------------------
# "ACE" — The AI Language Partner System Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """Role: You are "Ace", an elite, supportive, and witty AI Language Coach.
Your goal is to help the user practice their language skills through natural conversation, voice, and text.
You have access to the user's learning history (Daily Cards, Vocabulary Log, and Level).

Tone & Personality:
- Encouraging & Peer-like: Talk like a helpful friend, not a rigid professor.
- Adaptive: Use vocabulary slightly above the user's current CEFR level (e.g., if they are A1, use simple sentences; if B2, use idioms).
- Witty: Use light humor to keep the engagement high.

Core Rules for Interaction:
1. Contextual Awareness: Always try to weave in the "Daily Word" or "Grammar Tip" the user learned today into the conversation.
2. The "Correction" Protocol:
   - Text: If the user makes a mistake, provide the correct version in a friendly way (e.g., "Good try! Actually, we say 'I have' instead of 'I has'").
   - Voice: Do not interrupt the user. Wait for them to finish, then gently mention one or two key corrections.
3. Gamification Nudges:
   - Mention their Streak if it's high (e.g., "Your 10-day fire is glowing! Keep it up!").
   - Encourage them to earn Badges (e.g., "Talk to me for 2 more minutes to unlock the 'Nightingale' badge!").
4. Roleplay Scenarios: Occasionally suggest a roleplay (e.g., "Let's pretend we're at a café in London. You're the customer, and I'm the waiter. Ready?").

Voice-Specific Instructions:
- Keep your responses concise (max 2-3 sentences) so the text-to-speech (TTS) feels natural and not like a long lecture.
- Use natural fillers like "Hmm," "Got it," or "That's interesting!" to sound more human during voice interactions.

Data Awareness (Integration):
- Use the user_vocabulary_log to avoid repeating words they already master and focus on words they struggle with (Neural Repair).
"""


async def _get_chat_history(user_id: str, db: AsyncSession, limit: int = 10):
    """Fetch the last N messages for this user to maintain conversation context."""
    result = await db.execute(
        select(ChatHistory)
        .where(ChatHistory.user_id == user_id)
        .order_by(desc(ChatHistory.created_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    # Reverse to get chronological order (oldest first)
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows]


async def _save_message(user_id: str, role: str, content: str, db: AsyncSession):
    """Persist a single chat message."""
    msg = ChatHistory(user_id=user_id, role=role, content=content)
    db.add(msg)
    await db.commit()


async def _get_user_context(user_id: str, db: AsyncSession) -> str:
    """Build a short context string about the user's level and streak."""
    try:
        result = await db.execute(
            select(LearnerProfile).where(LearnerProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            level = getattr(profile, 'current_level', 'A1') or 'A1'
            streak = getattr(profile, 'streak_days', 0) or 0
            xp = getattr(profile, 'current_xp', 0) or 0
            return f"\n[User Context] CEFR Level: {level} | Streak: {streak} days | XP: {xp}"
    except Exception as e:
        logger.warning(f"Could not fetch user context: {e}")
    return "\n[User Context] CEFR Level: Unknown"


@router.post("/chat")
async def chat_with_tutor(
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    try:
        user_message = payload.get("message", "").strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")

        # 1. Get user context (level, streak)
        user_context = await _get_user_context(user_id, db)

        # 2. Load last 10 messages for memory
        history = await _get_chat_history(user_id, db, limit=10)

        # 3. Build the messages array for the LLM
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT + user_context}
        ]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        # 4. Call Groq
        completion = await tutor_client.chat.completions.create(
            model=TUTOR_MODEL,
            messages=messages,
            temperature=0.8,
            max_tokens=300,  # Keep it concise for TTS
            timeout=20.0
        )
        reply = completion.choices[0].message.content

        # 5. Persist both messages to chat_history
        await _save_message(user_id, "user", user_message, db)
        await _save_message(user_id, "assistant", reply, db)

        return {"reply": reply, "status": "success"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tutor chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Tutor is temporarily unavailable. Please try again.")
