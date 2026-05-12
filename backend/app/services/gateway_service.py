import logging
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.domain import LearnerProfile, LevelConfig
from app.services.pedagogy import PedagogyService
from app.integrations.groq_client import generate_session_batch

logger = logging.getLogger(__name__)

class GatewayService:
    """
    Orchestrates the Gateway Exam (Level Graduation) process.
    """

    @classmethod
    async def is_eligible(cls, user_id: str, db: AsyncSession) -> bool:
        """Checks if user has filled their XP reservoir for the current level."""
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        if not profile: return False
        
        return profile.is_gateway_unlocked

    @classmethod
    async def generate_gateway_exam(cls, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Generates a 20-question comprehensive exam.
        We use generate_session_batch 4 times (4x5 tasks) or a specialized prompt.
        """
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        if not profile: raise Exception("User profile not found")

        # Gateway Exam is anchored at the CEILING of the current level (difficulty 0.9)
        level = profile.current_proficiency_level
        domain = profile.goal_context or "General Professional"
        
        logger.info(f"🎓 Generating Gateway Exam for {user_id} at level {level}")
        
        # For efficiency in this MVP, we generate 2 batches of 5 high-difficulty tasks (10 total for now)
        # In production, this would be a full 20-question custom-architected set.
        batch1, _ = await generate_session_batch(
            user_level=level,
            user_domain=domain,
            weak_skills=profile.focus_skills or [],
            strongest_skill="Writing",
            recent_errors=[],
            journey_title=f"Gateway Exam: {level} Graduation",
            journey_skill="comprehensive",
            difficulty=0.9, # High difficulty for graduation
            skill_levels={s: level for s in ["writing", "reading", "listening", "speaking"]}
        )
        
        return {
            "exam_id": f"gateway_{level}_{user_id}",
            "level": level,
            "tasks": batch1.get("tasks", []),
            "required_score": 0.7
        }

    @classmethod
    async def finalize_exam(cls, user_id: str, total_score: float, db: AsyncSession) -> Dict[str, Any]:
        """Processes the exam results and handles promotion if passed."""
        await PedagogyService.handle_level_up(user_id, total_score, db)
        
        # Check if level actually changed
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        
        passed = total_score >= 0.7
        return {
            "passed": passed,
            "new_level": profile.current_proficiency_level,
            "score": total_score
        }
