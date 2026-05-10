import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID

from app.models.domain import DailyContent, UserErrorAnalysis
from app.integrations.groq_client import _call_groq_json, MODEL_TASK

logger = logging.getLogger(__name__)

_DAILY_BITES_SYSTEM_PROMPT = """# ROLE
You are an elite Senior ESL Content Architect and Curriculum Designer. Your goal is to generate high-impact, bite-sized daily learning content (micro-learning tasks) for an AI Language Tutor dashboard.

# OBJECTIVE
Generate one complete set of 5 daily learning items. The content must be brief, visually scannable, and highly practical.

# CONTEXT
- Target Level: {target_level}
- Professional Field: {field}
- Learning Goal: {learning_goal}

# CONTENT AREAS & LOGIC
1. vocabulary_progression: Show a core word (A1/A2) and upgrade it through two higher CEFR levels.
2. grammar_remediation: Provide a common ESL grammar mistake (incorrect, correct, 1-sentence rule).
3. style_transformer: Transform a basic sentence (B1) into an advanced/academic sentence (C1/C2).
4. punctuation_mechanics: Explain a single punctuation rule with a clear, short example.
5. daily_reminder_review: A quick Active Recall question based on general past concepts.

# OUTPUT FORMAT (STRICT JSON)
{{
  "date_generated": "{date_generated}",
  "daily_bites": {{
    "vocabulary": {{
      "topic": "string",
      "steps": [
        {{ "level": "A1/A2", "word": "string" }},
        {{ "level": "B2", "word": "string" }},
        {{ "level": "C1", "word": "string" }}
      ],
      "context_note": "string"
    }},
    "grammar": {{
      "type": "Common Mistake",
      "incorrect": "string",
      "correct": "string",
      "rule": "string"
    }},
    "style": {{
      "focus": "string",
      "basic_b1": "string",
      "advanced_c1_academic": "string",
      "style_note": "string"
    }},
    "punctuation": {{
      "focus": "string",
      "rule": "string",
      "example": "string"
    }},
    "reminder_review": {{
      "skill": "string",
      "question": "string",
      "answer": "string"
    }}
  }}
}}
"""

class DailyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_daily_bites(self, user_id: UUID, target_level: str = "B2", field: str = "AI Engineering", learning_goal: str = "Professional Fluency"):
        """
        Fetches or generates daily bites, then performs personalization swap.
        """
        try:
            today = datetime.now(timezone.utc).date()
            
            # 1. Fetch latest content for the level/field
            stmt = select(DailyContent).where(
                DailyContent.target_level == target_level,
                DailyContent.field == field
            ).order_by(desc(DailyContent.day_date))
            
            result = await self.db.execute(stmt)
            daily = result.scalars().first()
            
            # If none or older than today, generate new global one
            if not daily or daily.day_date.date() < today:
                logger.info(f"Generating new daily bites for {target_level} in {field}")
                content = await self._generate_new_daily_bites(target_level, field, learning_goal)
                daily = DailyContent(
                    target_level=target_level,
                    field=field,
                    content=content,
                    day_date=datetime.now(timezone.utc)
                )
                self.db.add(daily)
                await self.db.commit()
                await self.db.refresh(daily)
            
            # 2. Personalization Swap (Grammar)
            # Find the user's most significant recurring mistake
            err_stmt = select(UserErrorAnalysis).where(
                UserErrorAnalysis.user_id == user_id
            ).order_by(desc(UserErrorAnalysis.created_at))
            err_result = await self.db.execute(err_stmt)
            user_err = err_result.scalars().first()
            
            # Create a localized copy of the content
            final_content = daily.content.copy()
            
            if user_err and "daily_bites" in final_content:
                final_content["daily_bites"]["grammar"] = {
                    "type": "Personalized Remediation",
                    "incorrect": user_err.user_answer,
                    "correct": user_err.correct_answer,
                    "rule": user_err.ai_interpretation or user_err.deep_insight or "Focus on structural accuracy in this pattern."
                }
            
            return final_content
            
        except Exception as e:
            logger.error(f"DailyService Error: {str(e)}")
            # Fallback to a static object if everything fails
            return {
                "date_generated": datetime.now(timezone.utc).date().isoformat(),
                "daily_bites": {
                    "vocabulary": {"topic": "Progress", "steps": [{"level": "A1", "word": "Go"}, {"level": "B2", "word": "Proceed"}, {"level": "C1", "word": "Advance"}], "context_note": "Advance your career."},
                    "grammar": {"type": "Tip", "incorrect": "I am here for learn.", "correct": "I am here to learn.", "rule": "Use 'to' + infinitive for purpose."},
                    "style": {"focus": "Formality", "basic_b1": "Tell me more.", "advanced_c1_academic": "Could you please elaborate?", "style_note": "'Elaborate' is more precise."},
                    "punctuation": {"focus": "Commas", "rule": "Use commas in lists.", "example": "AI, ML, and NLP."},
                    "reminder_review": {"skill": "Recall", "question": "Yesterday's word for 'very big'?", "answer": "Substantial"}
                }
            }

    async def _generate_new_daily_bites(self, target_level: str, field: str, learning_goal: str):
        prompt = _DAILY_BITES_SYSTEM_PROMPT.format(
            target_level=target_level,
            field=field,
            learning_goal=learning_goal,
            date_generated=datetime.now(timezone.utc).date().isoformat()
        )
        
        user_msg = f"Generate daily micro-learning bites for a {target_level} learner in {field}."
        result = await _call_groq_json(MODEL_TASK, prompt, user_msg, use_task_client=True)
        return result
