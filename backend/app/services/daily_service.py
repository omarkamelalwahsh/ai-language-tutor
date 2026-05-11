import json
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID

from app.models.domain import DailyContent, UserErrorAnalysis, WeeklyVocabulary
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
1. vocabulary_progression: Show a core word (A1/A2) and upgrade it through two higher CEFR levels. Do NOT use 'use', 'utilize', or 'leverage' as they are already known.
2. grammar_remediation: Provide a common ESL grammar mistake (incorrect, correct, 1-sentence rule).
3. style_transformer: Transform a basic sentence (B1) into an advanced/academic sentence (C1/C2).
4. punctuation_mechanics: Explain a single punctuation rule with a clear, short example.
5. daily_reminder_review: A quick Active Recall question based on general past concepts.

# VARIETY
Ensure the content is fresh and unique for {date_generated}. Avoid repeating common examples.

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

_WEEKLY_VOCAB_SYSTEM_PROMPT = """# ROLE
Expert Curriculum Developer & Data Engineer.

# OBJECTIVE
Generate a structured weekly vocabulary set for a "Memory Tracker" widget. The logic is based on a 7-day cycle (Saturday to Friday). 
The focus of the audio is purely on the target word for clear pronunciation.

# SYSTEM LOGIC
- Daily Slotting: Assign exactly one "Target Word" to each day of the week.
- Progression Tone: Each word must follow the "Level-up" logic (showing A1/A2 base vs. C1 advanced).
- Weekly Refresh: Ensure the set is thematic (e.g., all words relate to {field}) but resets every Saturday.
- Professional Field: {field}
- Target Level: {target_level}

# CONTENT REQUIREMENTS (PER DAY)
- Day Name: (Saturday, Sunday, Monday, Tuesday, Wednesday, Thursday, Friday).
- Target Word (C1): The advanced word for that day.
- Base Word (A1): The simple equivalent.
- Audio Script: This field must ONLY contain the word_c1. No sentences, no context.
- Insight: A brief note on why this word is better for the user's field.

# OUTPUT FORMAT (STRICT JSON)
{{
  "week_info": {{
    "cycle_start": "Saturday",
    "theme": "Professional Efficiency in {field}",
    "target_level": "{target_level}"
  }},
  "weekly_log": [
    {{
      "day": "Saturday",
      "data": {{
        "word_c1": "Synthesize",
        "word_a1": "Combine",
        "audio_script": "Synthesize",
        "insight": "Merging complex data or ideas."
      }}
    }},
    {{ "day": "Sunday", "data": {{ "word_c1": "Augment", "word_a1": "Increase", "audio_script": "Augment", "insight": "Enhancing or adding to something." }} }},
    {{ "day": "Monday", "data": {{ "word_c1": "string", "word_a1": "string", "audio_script": "string", "insight": "string" }} }},
    {{ "day": "Tuesday", "data": {{ "word_c1": "string", "word_a1": "string", "audio_script": "string", "insight": "string" }} }},
    {{ "day": "Wednesday", "data": {{ "word_c1": "string", "word_a1": "string", "audio_script": "string", "insight": "string" }} }},
    {{ "day": "Thursday", "data": {{ "word_c1": "string", "word_a1": "string", "audio_script": "string", "insight": "string" }} }},
    {{ "day": "Friday", "data": {{ "word_c1": "string", "word_a1": "string", "audio_script": "string", "insight": "string" }} }}
  ]
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
    @staticmethod
    def get_custom_day_index() -> int:
        """
        Returns the current day's index in our Saturday-start cycle.
        Saturday=0, Sunday=1, Monday=2, Tuesday=3, Wednesday=4, Thursday=5, Friday=6
        Python weekday(): Monday=0, Tuesday=1, ..., Saturday=5, Sunday=6
        """
        system_weekday = datetime.now(timezone.utc).weekday()
        return (system_weekday + 2) % 7

    @staticmethod
    def get_last_saturday() -> datetime:
        """Returns the date of the most recent Saturday (start of current cycle)."""
        now = datetime.now(timezone.utc)
        day_index = (now.weekday() + 2) % 7  # days since Saturday
        last_sat = now - timedelta(days=day_index)
        return last_sat.replace(hour=0, minute=0, second=0, microsecond=0)

    async def get_daily_word(self, target_level: str = "B2", field: str = "AI Engineering"):
        """
        Returns the single word entry for TODAY from the weekly_vocabulary table.
        If the week hasn't been generated yet, triggers generation first.
        """
        try:
            await self._ensure_weekly_generation(target_level, field)
            
            current_day_index = self.get_custom_day_index()
            last_saturday = self.get_last_saturday().date()
            
            stmt = select(WeeklyVocabulary).where(
                WeeklyVocabulary.week_start_date == last_saturday,
                WeeklyVocabulary.day_index == current_day_index
            )
            result = await self.db.execute(stmt)
            word = result.scalars().first()
            
            if not word:
                return None
            
            day_names = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
            return {
                "day": day_names[word.day_index],
                "day_index": word.day_index,
                "word_c1": word.word_c1,
                "word_a1": word.word_a1,
                "insight": word.insight,
                "audio_url": word.audio_url
            }
        except Exception as e:
            logger.error(f"get_daily_word Error: {str(e)}")
            return None

    async def get_weekly_log(self, target_level: str = "B2", field: str = "AI Engineering"):
        """
        Returns ALL 7 entries for the current week from weekly_vocabulary.
        Frontend decides visibility based on day_index vs current day.
        """
        try:
            await self._ensure_weekly_generation(target_level, field)
            
            last_saturday = self.get_last_saturday().date()
            
            stmt = select(WeeklyVocabulary).where(
                WeeklyVocabulary.week_start_date == last_saturday
            ).order_by(WeeklyVocabulary.day_index)
            
            result = await self.db.execute(stmt)
            words = result.scalars().all()
            
            day_names = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
            current_day_index = self.get_custom_day_index()
            
            # Calculate time until next word unlock (midnight)
            now = datetime.now(timezone.utc)
            next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            diff = next_midnight - now
            hours_left = int(diff.total_seconds() // 3600)
            minutes_left = int((diff.total_seconds() % 3600) // 60)
            
            return {
                "current_day_index": current_day_index,
                "next_word_in": f"{hours_left}h {minutes_left}m",
                "weekly_log": [
                    {
                        "day": day_names[w.day_index],
                        "day_index": w.day_index,
                        "data": {
                            "word_c1": w.word_c1,
                            "word_a1": w.word_a1,
                            "audio_script": w.word_c1,  # Word-only audio
                            "insight": w.insight
                        }
                    }
                    for w in words
                ]
            }
        except Exception as e:
            logger.error(f"get_weekly_log Error: {str(e)}")
            return {"current_day_index": 0, "next_word_in": "—", "weekly_log": []}

    async def _ensure_weekly_generation(self, target_level: str, field: str):
        """Check if this week's words exist. If not, generate them."""
        last_saturday = self.get_last_saturday().date()
        
        stmt = select(WeeklyVocabulary).where(
            WeeklyVocabulary.week_start_date == last_saturday
        ).limit(1)
        result = await self.db.execute(stmt)
        exists = result.scalars().first()
        
        if not exists:
            logger.info(f"No weekly vocab found for {last_saturday}. Generating...")
            await self._generate_and_insert_weekly(target_level, field, last_saturday)

    async def _generate_and_insert_weekly(self, target_level: str, field: str, week_start: datetime):
        """Call AI to generate 7 words, then insert them as individual rows."""
        prompt = _WEEKLY_VOCAB_SYSTEM_PROMPT.format(
            target_level=target_level,
            field=field
        )
        user_msg = f"Generate a weekly vocabulary set for a {target_level} learner in {field} starting this Saturday."
        
        try:
            ai_result = await _call_groq_json(MODEL_TASK, prompt, user_msg, use_task_client=True)
            weekly_log = ai_result.get("weekly_log", [])
            
            for i, entry in enumerate(weekly_log[:7]):
                data = entry.get("data", {})
                word = WeeklyVocabulary(
                    day_index=i,
                    word_c1=data.get("word_c1", "Unknown"),
                    word_a1=data.get("word_a1", "Unknown"),
                    insight=data.get("insight", ""),
                    audio_url=None,
                    week_start_date=week_start
                )
                self.db.add(word)
            
            await self.db.commit()
            logger.info(f"Inserted {len(weekly_log[:7])} weekly vocab entries for {week_start}")
        except Exception as e:
            logger.error(f"Weekly generation failed: {str(e)}")
            await self.db.rollback()

