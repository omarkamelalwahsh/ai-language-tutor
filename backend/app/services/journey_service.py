from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID, uuid4
import logging
import json
from datetime import datetime

from app.models.domain import LearningJourney, JourneyStep, LearnerProfile, UserErrorProfile
from app.integrations.groq_client import generate_roadmap

class JourneyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_journey(self, user_id: UUID) -> dict:
        """
        Fetches the existing journey or triggers AI generation if missing.
        """
        try:
            # 1. Check for existing journey
            stmt = select(LearningJourney).where(LearningJourney.user_id == user_id)
            result = await self.db.execute(stmt)
            journey = result.scalar_one_or_none()

            if journey:
                # Fetch associated steps
                steps_stmt = select(JourneyStep).where(JourneyStep.journey_id == journey.id).order_by(JourneyStep.order_index.asc())
                steps_result = await self.db.execute(steps_stmt)
                steps = steps_result.scalars().all()
                
                return {
                    "journey_id": str(journey.id),
                    "nodes": [
                        {
                            "id": str(s.id),
                            "title": s.title,
                            "description": s.description,
                            "type": s.icon_type, # lessons, drills, etc map to icons
                            "status": s.status,
                            "skill_focus": s.skill_focus,
                            "is_locked": s.is_locked
                        } for s in steps
                    ],
                    "status": "active"
                }

            # 2. No journey found. Trigger AI Generation.
            return await self.generate_new_journey(user_id)
            
        except Exception as e:
            logging.error(f"[JourneyService] Error: {str(e)}")
            raise e

    async def generate_new_journey(self, user_id: UUID) -> dict:
        """
        Calls 70B Model to architect a roadmap based on assessment outcomes.
        """
        try:
            # Fetch profile and error profile for context
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
            
            err_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            err_profile = (await self.db.execute(err_stmt)).scalar_one_or_none()
            
            current_level = profile.current_proficiency_level if profile else "A1"
            # Target logic: +1 level
            levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
            try:
                curr_idx = levels.index(current_level)
                target_level = levels[min(curr_idx + 1, len(levels)-1)]
            except:
                target_level = "B1"

            weakness_areas = getattr(err_profile, 'weakness_areas', []) or []
            common_mistakes = getattr(err_profile, 'common_mistakes', []) or []

            # Call AI
            raw_roadmap, _ = await generate_roadmap(
                current_level=current_level,
                target_level=target_level,
                weakness_areas=weakness_areas,
                common_mistakes=common_mistakes
            )

            # 3. Persist to DB
            new_journey = LearningJourney(
                id=uuid4(),
                user_id=user_id,
                metadata={"pedagogical_summary": raw_roadmap.get("pedagogical_summary", "")}
            )
            self.db.add(new_journey)
            await self.db.flush()

            nodes = raw_roadmap.get("nodes", [])
            for i, node in enumerate(nodes):
                is_first = (i == 0)
                new_step = JourneyStep(
                    id=uuid4(),
                    journey_id=new_journey.id,
                    title=node.get("title", "Linguistic Objective"),
                    description=node.get("description", ""),
                    order_index=i,
                    status="active" if is_first else "locked",
                    icon_type=node.get("type", "lesson"),
                    skill_focus=node.get("skill_focus", "general"),
                    is_locked=not is_first,
                    content_payload=node
                )
                self.db.add(new_step)

            await self.db.commit()
            
            # Recurse to return formatted
            return await self.get_or_create_journey(user_id)

        except Exception as e:
            logging.error(f"[JourneyService] Generation Error: {str(e)}")
            await self.db.rollback()
            # Return a "Calibration" state or dummy if AI fails
            return {"status": "calibration", "nodes": []}
