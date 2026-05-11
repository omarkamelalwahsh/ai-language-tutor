import json
import logging
from datetime import datetime, timezone, timedelta, date
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
        Synchronizes the vocabulary bite with the word of the day from the weekly cycle.
        """
        try:
            today_dt = datetime.now(timezone.utc)
            today = today_dt.date()
            
            # 1. Fetch latest content for the level/field
            stmt = select(DailyContent).where(
                DailyContent.target_level == target_level,
                DailyContent.field == field
            ).order_by(desc(DailyContent.day_date))
            
            result = await self.db.execute(stmt)
            daily = result.scalars().first()
            
            # If none or older than today, generate new global one
            if not daily or daily.day_date.date() < today:
                content = await self._generate_new_daily_bites(target_level, field, learning_goal)
                daily = DailyContent(
                    target_level=target_level,
                    field=field,
                    content=content,
                    day_date=today_dt
                )
                self.db.add(daily)
                await self.db.commit()
                await self.db.refresh(daily)
            
            # 2. SYNC: Inject current day's word from WeeklyVocabulary
            weekly_word = await self.get_daily_word(target_level, field)
            final_content = daily.content.copy()
            
            # Ensure the structure exists
            if "daily_bites" not in final_content:
                final_content["daily_bites"] = {}
            
            if weekly_word:
                # Override or Create the vocabulary bite to match the Weekly Journey
                final_content["daily_bites"]["vocabulary"] = {
                    "topic": f"Daily Journey: {weekly_word['day']}",
                    "steps": [
                        { "level": "A1/A2", "word": weekly_word["word_a1"] },
                        { "level": "B2", "word": "Expanding..." }, # Placeholder middle step
                        { "level": "C1", "word": weekly_word["word_c1"] }
                    ],
                    "context_note": weekly_word["insight"]
                }
            
            # 3. Personalization Swap (Grammar)
            err_stmt = select(UserErrorAnalysis).where(
                UserErrorAnalysis.user_id == user_id
            ).order_by(desc(UserErrorAnalysis.created_at))
            err_result = await self.db.execute(err_stmt)
            user_err = err_result.scalars().first()
            
            if user_err and "daily_bites" in final_content:
                final_content["daily_bites"]["grammar"] = {
                    "type": "Personalized Remediation",
                    "incorrect": user_err.user_answer,
                    "correct": user_err.correct_answer,
                    "rule": user_err.ai_interpretation or user_err.deep_insight or "Focus on structural accuracy."
                }
            
            return final_content

            
        except Exception as e:
            logger.error(f"DailyService Error: {str(e)}")
            return None

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
        """Saturday=0, Sunday=1, ..., Friday=6"""
        system_weekday = datetime.now(timezone.utc).weekday()
        return (system_weekday + 2) % 7

    @staticmethod
    def get_last_saturday() -> datetime:
        now = datetime.now(timezone.utc)
        day_index = (now.weekday() + 2) % 7
        last_sat = now - timedelta(days=day_index)
        return last_sat.replace(hour=0, minute=0, second=0, microsecond=0)

    async def get_daily_word(self, target_level: str = "B2", field: str = "AI Engineering"):
        """Returns today's word from the single-source weekly batch."""
        try:
            current_day_index = self.get_custom_day_index()
            last_saturday = self.get_last_saturday().date()
            
            # Ensure the 7-day batch exists for this week
            await self._ensure_weekly_batch(target_level, field, last_saturday)
            
            stmt = select(WeeklyVocabulary).where(
                WeeklyVocabulary.week_start_date == last_saturday,
                WeeklyVocabulary.day_index == current_day_index
            )
            result = await self.db.execute(stmt)
            word = result.scalars().first()
            
            if not word: return None
            
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

    async def get_weekly_log(self, user_id: UUID, target_level: str = "B2", field: str = "AI Engineering"):
        """Returns the 7-day log, hiding past words that pre-date the user's registration."""
        try:
            last_saturday = self.get_last_saturday().date()
            await self._ensure_weekly_batch(target_level, field, last_saturday)
            
            # Fetch user registration date for the "New User Guard"
            from app.models.domain import LearnerProfile
            profile_stmt = select(LearnerProfile.created_at).where(LearnerProfile.id == user_id)
            profile_res = await self.db.execute(profile_stmt)
            user_created_at = profile_res.scalars().first()
            user_created_date = user_created_at.date() if user_created_at else last_saturday
            
            stmt = select(WeeklyVocabulary).where(
                WeeklyVocabulary.week_start_date == last_saturday
            ).order_by(WeeklyVocabulary.day_index)
            
            result = await self.db.execute(stmt)
            existing_words = {w.day_index: w for w in result.scalars().all()}
            
            day_names = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
            current_day_index = self.get_custom_day_index()
            
            now = datetime.now(timezone.utc)
            next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            diff = next_midnight - now
            
            full_log = []
            for i in range(7):
                w = existing_words.get(i)
                # New User Guard: If the word's date is before user registration, hide it.
                word_date = last_saturday + timedelta(days=i)
                is_visible_to_user = word_date >= user_created_date
                
                full_log.append({
                    "day": day_names[i],
                    "day_index": i,
                    "data": {
                        "word_c1": w.word_c1,
                        "word_a1": w.word_a1,
                        "audio_script": w.word_c1,
                        "insight": w.insight
                    } if (w and is_visible_to_user) else None
                })

            return {
                "current_day_index": current_day_index,
                "next_word_in": f"{int(diff.total_seconds() // 3600)}h {int((diff.total_seconds() % 3600) // 60)}m",
                "weekly_log": full_log
            }
        except Exception as e:
            logger.error(f"get_weekly_log Error: {str(e)}")
            return {"current_day_index": 0, "next_word_in": "—", "weekly_log": []}

    async def _ensure_weekly_batch(self, target_level: str, field: str, week_start: date):
        """Checks if the 7-day batch exists, generates it if not."""
        stmt = select(WeeklyVocabulary).where(
            WeeklyVocabulary.week_start_date == week_start
        ).limit(1)
        result = await self.db.execute(stmt)
        if not result.scalars().first():
            await self._generate_and_insert_weekly_batch(target_level, field, week_start)

    async def _generate_and_insert_weekly_batch(self, target_level: str, field: str, week_start: datetime):
        """Uses the user's strict prompt to generate 7 unique words at once."""
        prompt = f"""# ROLE: Backend Data Architect.
# OBJECTIVE: Generate a strictly synchronized 7-day vocabulary set where the "Daily Card" and the "Weekly Tracker" share the same data points.

# RULES:
1. No Duplicates: Each of the 7 days must have a unique C1 word.
2. Contextual Alignment: All words must relate to {field} and be at {target_level} level.
3. Array Structure: Generate exactly 7 objects (Saturday to Friday).

# OUTPUT FORMAT (JSON ONLY):
{{
  "weekly_payload": [
    {{
      "day_index": 0,
      "day_name": "Saturday",
      "word_c1": "Synthesize",
      "word_a1": "Combine",
      "insight": "Merging multiple data sources into a unified model."
    }},
    ...
  ]
}}
"""
        try:
            ai_result = await _call_groq_json(MODEL_TASK, prompt, "Generate 7-day vocabulary batch.", use_task_client=True)
            payload = ai_result.get("weekly_payload", [])
            for entry in payload[:7]:
                word = WeeklyVocabulary(
                    day_index=entry.get("day_index"),
                    word_c1=entry.get("word_c1"),
                    word_a1=entry.get("word_a1"),
                    insight=entry.get("insight"),
                    week_start_date=week_start
                )
                self.db.add(word)
            await self.db.commit()
        except Exception as e:
            logger.error(f"Weekly batch generation failed: {str(e)}")
            await self.db.rollback()



