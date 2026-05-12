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

    async def start_assessment(self, request) -> Assessment:
        """
        Starts a new assessment session.
        """
        from app.models.domain import Assessment, AssessmentStatus
        new_assessment = Assessment(
            user_id=request.user_id,
            status=AssessmentStatus.in_progress.value,
            total_questions=40,
            current_index=0,
            created_at=datetime.utcnow()
        )
        self.db.add(new_assessment)
        await self.db.commit()
        await self.db.refresh(new_assessment)
        return new_assessment

    async def get_latest_in_progress_assessment(self, user_id: UUID) -> Optional[Assessment]:
        from app.models.domain import Assessment, AssessmentStatus
        stmt = select(Assessment).where(
            Assessment.user_id == user_id,
            Assessment.status == AssessmentStatus.in_progress.value
        ).order_by(Assessment.created_at.desc()).limit(1)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def evaluate_response(self, item) -> dict:
        """
        Evaluates a single response and syncs it.
        """
        from app.integrations.groq_client import evaluate_dynamic_task
        from app.models.domain import QuestionBankItem
        
        # 1. Fetch Question Metadata
        q_stmt = select(QuestionBankItem).where(QuestionBankItem.id == item.question_id)
        question = (await self.db.execute(q_stmt)).scalar_one_or_none()
        
        prompt = question.prompt if question else "Evaluate this response."
        rubric = question.rubric if question else {}

        # 2. Call LLM Evaluator
        evaluation, _ = await evaluate_dynamic_task(
            prompt=prompt,
            rubric=rubric,
            user_response=item.user_answer
        )

        # 3. Sync to DB
        await self.sync_evaluation_to_db(
            user_id=item.user_id,
            evaluation_result=evaluation,
            skill=question.skill if question else "general",
            task_id=item.question_id,
            assessment_id=item.assessment_id
        )

        return evaluation

    async def sync_evaluation_to_db(
        self, 
        user_id: UUID, 
        evaluation_result: dict, 
        skill: str, 
        task_id: UUID = None,
        assessment_id: UUID = None
    ):
        """
        Synchronizes Model 2 (Evaluator) results with the PostgreSQL state.
        Updates accuracy, bridges error profiles, and evolves skill states.
        """
        try:
            is_correct = evaluation_result.get("is_correct", False)
            score = evaluation_result.get("score", 0) # 0-100
            
            # 1. Update LearnerProfile (Weighted Accuracy & Last Active)
            profile_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(profile_stmt)).scalar_one_or_none()
            
            if profile:
                old_accuracy = profile.accuracy_rate or 0.0
                # Weighted average: (Old * 0.8) + (New * 0.2)
                new_accuracy = (old_accuracy * 0.8) + ((score / 100.0) * 0.2)
                profile.accuracy_rate = new_accuracy
                profile.last_active_at = datetime.utcnow()
                
                # Update total XP at profile level too
                xp_gain = int(score) // 2 if is_correct else 5
                profile.xp_points = (profile.xp_points or 0) + xp_gain
                
                # Increment totals
                profile.total_questions_answered = (profile.total_questions_answered or 0) + 1

            # 2. Update UserErrorProfile (Bridge Logic)
            err_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            err_profile = (await self.db.execute(err_stmt)).scalar_one_or_none()
            
            if err_profile:
                current_bridge = err_profile.bridge_percentage or 0.0
                if is_correct:
                    err_profile.bridge_percentage = min(current_bridge + 0.10, 1.0)
                else:
                    err_profile.bridge_percentage = max(current_bridge - 0.05, 0.0)
                
                err_profile.updated_at = datetime.utcnow()

            # 3. Update UserSkill (Skill Evolution)
            skill_stmt = select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill == skill.lower())
            user_skill = (await self.db.execute(skill_stmt)).scalar_one_or_none()
            
            # Calculate XP gain for this skill
            xp_gain = int(score) if is_correct else 10
            
            if user_skill:
                user_skill.xp_points = (user_skill.xp_points or 0) + xp_gain
                user_skill.current_score = (score / 100.0)
                if score > 80:
                    user_skill.proficiency_confidence = min((user_skill.proficiency_confidence or 0.0) + 0.05, 1.0)
                user_skill.last_tested = datetime.utcnow()
            else:
                # Create if missing
                new_skill = UserSkill(
                    user_id=user_id,
                    skill=skill.lower(),
                    xp_points=xp_gain,
                    current_score=(score / 100.0),
                    proficiency_confidence=0.10 if score > 80 else 0.05,
                    last_tested=datetime.utcnow()
                )
                self.db.add(new_skill)

            # 4. Log the activity in AssessmentResponse and AssessmentLog
            from app.models.domain import AssessmentLog
            new_response = AssessmentResponse(
                assessment_id=assessment_id,
                user_id=user_id,
                question_id=task_id,
                skill=skill,
                is_correct=is_correct,
                score=score / 100.0,
                raw_evaluation=evaluation_result,
                explanation=evaluation_result.get("detailed_feedback", ""),
                created_at=datetime.utcnow()
            )
            self.db.add(new_response)
            
            # Flatter log for dashboard trends
            new_log = AssessmentLog(
                assessment_id=assessment_id,
                user_id=user_id,
                skill=skill,
                score=score / 100.0,
                is_correct=is_correct,
                duration_ms=evaluation_result.get("duration_ms", 0),
                created_at=datetime.utcnow()
            )
            self.db.add(new_log)

            # Commit Transaction
            await self.db.commit()
            logger.info(f"Successfully synced evaluation for user {user_id}. Score: {score}, XP Gain: {xp_gain}")
            return True

    async def complete_assessment(self, assessment_id: UUID, user_id: UUID) -> dict:
        """
        Finalizes assessment, updates proficiency levels, and generates report.
        """
        from app.models.domain import Assessment, AssessmentStatus, AssessmentResponse
        
        # 1. Mark Assessment as Completed
        stmt = select(Assessment).where(Assessment.id == assessment_id)
        assessment = (await self.db.execute(stmt)).scalar_one_or_none()
        if not assessment:
            raise ValueError("Assessment not found")
            
        assessment.status = AssessmentStatus.completed.value
        assessment.completed_at = datetime.utcnow()

        # 2. Aggregate Results for CEFR Calculation
        resp_stmt = select(AssessmentResponse).where(AssessmentResponse.assessment_id == assessment_id)
        responses = (await self.db.execute(resp_stmt)).scalars().all()
        
        skill_scores = {}
        for r in responses:
            s = r.skill.lower()
            if s not in skill_scores: skill_scores[s] = []
            skill_scores[s].append(r.score)

        # 3. Update Proficiency Levels & XP in UserSkill
        final_levels = {}
        total_xp_boost = 0
        for skill, scores in skill_scores.items():
            avg_score = sum(scores) / len(scores) if scores else 0
            
            # Simple level mapping
            level = "A1"
            if avg_score > 0.85: level = "C1"
            elif avg_score > 0.70: level = "B2"
            elif avg_score > 0.50: level = "B1"
            elif avg_score > 0.30: level = "A2"
            
            final_levels[skill] = level
            
            # Update UserSkill
            s_stmt = select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill == skill)
            u_skill = (await self.db.execute(s_stmt)).scalar_one_or_none()
            
            xp_bonus = int(avg_score * 1000) # Give up to 1000 XP for initial assessment
            total_xp_boost += xp_bonus
            
            if u_skill:
                u_skill.current_proficiency_level = level
                u_skill.xp_points = (u_skill.xp_points or 0) + xp_bonus
                u_skill.proficiency_confidence = 0.90
            else:
                new_s = UserSkill(
                    user_id=user_id,
                    skill=skill,
                    current_proficiency_level=level,
                    xp_points=xp_bonus,
                    proficiency_confidence=0.90,
                    last_tested=datetime.utcnow()
                )
                self.db.add(new_s)

        # 4. Update Overall Level in LearnerProfile
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
        if profile:
            # Simple majority or highest level
            profile.overall_level = max(final_levels.values(), key=lambda x: ["A1", "A2", "B1", "B2", "C1", "C2"].index(x))
            profile.xp_points = (profile.xp_points or 0) + total_xp_boost
            profile.has_completed_assessment = True

        await self.db.commit()
        
        return {
            "final_cefr_level": profile.overall_level if profile else "A1",
            "skills_breakdown": final_levels,
            "reasoning": "Performance-based CEFR estimation from initial diagnostic."
        }
