from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from uuid import UUID
import logging
from datetime import datetime

from app.models.domain import LearnerProfile, UserErrorProfile, UserSkill, AssessmentResponse

logger = logging.getLogger(__name__)

class AssessmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_task_metadata(self, step_id: UUID) -> dict:
        """
        Fetches task metadata (rubric, prompt, etc.) for a specific journey step.
        """
        from app.models.domain import JourneyStep
        stmt = select(JourneyStep).where(JourneyStep.id == step_id)
        result = await self.db.execute(stmt)
        step = result.scalar_one_or_none()
        
        if not step:
            raise ValueError(f"Journey step {step_id} not found")
            
        return step.content_payload or {}

    async def sync_evaluation_to_db(
        self, 
        user_id: UUID, 
        evaluation_result: dict, 
        skill: str, 
        task_id: UUID = None
    ):
        """
        Synchronizes Model 2 (Evaluator) results with the PostgreSQL state.
        Updates accuracy, bridges error profiles, and evolves skill states.
        """
        try:
            is_correct = evaluation_result.get("is_correct", False)
            score = evaluation_result.get("score", 0)
            
            # 1. Update LearnerProfile (Weighted Accuracy & Last Active)
            profile_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(profile_stmt)).scalar_one_or_none()
            
            if profile:
                old_accuracy = profile.accuracy_rate or 0.0
                # Weighted average: (Old * 0.8) + (New * 0.2)
                new_accuracy = (old_accuracy * 0.8) + ((score / 100.0) * 0.2)
                profile.accuracy_rate = new_accuracy
                profile.last_active_at = datetime.utcnow()
                
                # Increment totals
                profile.total_questions_answered = (profile.total_questions_answered or 0) + 1

            # 2. Update UserErrorProfile (Bridge Logic)
            # Note: We look for the profile first. 
            # In a real scenario, we might want to match the specific weakness_area string.
            err_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            err_profile = (await self.db.execute(err_stmt)).scalar_one_or_none()
            
            if err_profile:
                current_bridge = err_profile.bridge_percentage or 0.0
                if is_correct:
                    # Success: Bridge grows
                    err_profile.bridge_percentage = min(current_bridge + 0.10, 1.0)
                else:
                    # Failure: Bridge regresses
                    err_profile.bridge_percentage = max(current_bridge - 0.05, 0.0)
                
                err_profile.updated_at = datetime.utcnow()

            # 3. Update UserSkill (Skill Evolution)
            skill_stmt = select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill == skill)
            user_skill = (await self.db.execute(skill_stmt)).scalar_one_or_none()
            
            if user_skill:
                if score > 80:
                    user_skill.proficiency_confidence = min((user_skill.proficiency_confidence or 0.0) + 0.05, 1.0)
                user_skill.last_tested = datetime.utcnow()
            else:
                # Create if missing
                new_skill = UserSkill(
                    user_id=user_id,
                    skill=skill,
                    proficiency_confidence=0.05 if score > 80 else 0.0,
                    last_tested=datetime.utcnow()
                )
                self.db.add(new_skill)

            # 4. Log the activity in AssessmentResponse
            new_response = AssessmentResponse(
                user_id=user_id,
                skill=skill,
                is_correct=is_correct,
                score=score / 100.0,
                raw_evaluation=evaluation_result,
                explanation=evaluation_result.get("detailed_feedback", ""),
                created_at=datetime.utcnow()
            )
            self.db.add(new_response)

            # Commit Transaction
            await self.db.commit()
            logger.info(f"Successfully synced evaluation for user {user_id}. Score: {score}")
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to sync evaluation to DB: {str(e)}")
            raise e
