from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select, update, func
from uuid import UUID
import json
from app.models.domain import Assessment, AssessmentResponse, AssessmentStatus, LearnerProfile, UserErrorProfile, UserErrorAnalysis
from app.schemas.evaluation import StartAssessmentRequest, AssessmentResponseItem, EvaluationResponse, NormalizedFields
from app.integrations.groq_client import evaluate_answer, audit_assessment
from app.core.config import settings
from datetime import datetime

class AssessmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_assessment(self, request: StartAssessmentRequest) -> Assessment:
        # Check if user profile exists, if not create one placeholder
        stmt = select(LearnerProfile).where(LearnerProfile.id == request.user_id)
        result = await self.db.execute(stmt)
        profile = result.scalar_one_or_none()
        
        if not profile:
            new_profile = LearnerProfile(id=request.user_id, full_name="Learner", overall_level="Pending")
            self.db.add(new_profile)
            
        assessment = Assessment(
            user_id=request.user_id,
            status=AssessmentStatus.in_progress.value
        )
        self.db.add(assessment)
        await self.db.commit()
        await self.db.refresh(assessment)
        return assessment

    async def evaluate_response(self, item: AssessmentResponseItem) -> EvaluationResponse:
        """
        Evaluates a single question answer via Groq LLM, stores the raw response 
        using ATOMIC UPSERT to prevent duplicates, and performs real-time error analysis.
        """
        # 1. Fetch the assessment context
        stmt = select(Assessment).where(Assessment.id == item.assessment_id).where(Assessment.user_id == item.user_id)
        result = await self.db.execute(stmt)
        assessment = result.scalar_one_or_none()
        if not assessment:
            raise ValueError("Assessment not found or unauthorized")
        
        if assessment.status != AssessmentStatus.in_progress.value:
            # If already completed, just return existing evaluation if it exists? 
            # Or just block it.
            raise ValueError("Assessment is already finished.")

        # 2. Call Groq
        expected_answer = "OPEN ENDED" # Can be extended
        raw_json, model_used = await evaluate_answer(
            prompt=item.prompt,
            expected_answer=expected_answer,
            user_answer=item.user_answer,
            current_level=item.current_band,
            history="[]"
        )

        score = float(raw_json.get("score", 0.0))
        is_correct = bool(raw_json.get("is_correct", False))
        predicted_level = raw_json.get("detected_level", item.current_band)

        # 3. ATOMIC UPSERT into assessment_responses
        # This handles the case where frontend retries the same question
        insert_stmt = insert(AssessmentResponse).values(
            assessment_id=item.assessment_id,
            user_id=item.user_id,
            question_id=item.question_id,
            user_answer=item.user_answer,
            is_correct=is_correct,
            score=score,
            answer_level=predicted_level,
            raw_evaluation=raw_json,
            skill=item.skill,
            created_at=func.now()
        )
        
        upsert_stmt = insert_stmt.on_conflict_do_update(
            constraint='uq_assessment_question',
            set_={
                'user_answer': insert_stmt.excluded.user_answer,
                'is_correct': insert_stmt.excluded.is_correct,
                'score': insert_stmt.excluded.score,
                'answer_level': insert_stmt.excluded.answer_level,
                'raw_evaluation': insert_stmt.excluded.raw_evaluation
            }
        )
        await self.db.execute(upsert_stmt)

        # 4. REAL-TIME ERROR ANALYSIS: If incorrect, record it immediately
        if not is_correct:
            # Ensure UserErrorProfile exists
            err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == item.user_id)
            err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()
            
            if not err_profile:
                err_profile = UserErrorProfile(user_id=item.user_id, full_report={})
                self.db.add(err_profile)
                await self.db.flush() # Get the ID

            # Insert analysis record
            analysis = UserErrorAnalysis(
                profile_id=err_profile.id,
                user_id=item.user_id,
                question_id=item.question_id,
                category=item.skill,
                user_answer=item.user_answer,
                is_correct=False,
                ai_interpretation=raw_json.get("feedback", "No specific error detected"),
                question_number=item.question_number
            )
            self.db.add(analysis)

        # 5. Increment Progression
        # Update current_index based on the question_number if it's the latest
        if item.question_number >= assessment.current_index:
            assessment.current_index = item.question_number + 1

        # 6. Check for Auto-Completion
        # We use settings.ASSESSMENT_TOTAL_QUESTIONS (default 40)
        await self.db.commit()
        
        if assessment.current_index >= settings.ASSESSMENT_TOTAL_QUESTIONS or item.is_last_question:
            # Trigger completion aggregation
            await self.complete_assessment(assessment.id, item.user_id)

        return EvaluationResponse(
            assessment_id=item.assessment_id,
            question_id=item.question_id,
            evaluation_model=model_used,
            result=raw_json,
            normalized_fields=NormalizedFields(
                is_correct=is_correct,
                score=score,
                predicted_level=predicted_level
            )
        )

    async def complete_assessment(self, assessment_id: UUID, user_id: UUID) -> dict:
        """
        Completes the assessment, performs final auditing via Groq based on history,
        and updates the user profile. This version relies on the real-time errors 
        gathered during the assessment for the detailed list.
        """
        stmt = select(Assessment).where(Assessment.id == assessment_id).where(Assessment.user_id == user_id)
        result = await self.db.execute(stmt)
        assessment = result.scalar_one_or_none()
        
        if not assessment:
            raise ValueError("Assessment not found")
        if assessment.status == AssessmentStatus.completed.value:
            return assessment.evaluation_metadata # Already done

        # Fetch all responses for the history context to calculate final CEFR
        resp_stmt = select(AssessmentResponse).where(AssessmentResponse.assessment_id == assessment_id)
        responses = (await self.db.execute(resp_stmt)).scalars().all()
        
        history_context = []
        for r in responses:
            history_context.append({
                "skill": r.skill,
                "answer": r.user_answer,
                "is_correct": r.is_correct,
                "score": r.score,
                "level": r.answer_level
            })

        # Run Audit Evaluation (Groq) - expensive but necessary for final placement
        raw_audit, model_used = await audit_assessment(json.dumps(history_context))
        
        final_level = raw_audit.get("final_cefr_level", "A1")

        # Update assessment status
        assessment.status = AssessmentStatus.completed.value
        assessment.completed_at = datetime.utcnow()
        assessment.evaluation_metadata = raw_audit
        
        # Update User Profile with the final CEFR placement
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
        if profile:
            profile.overall_level = final_level
            profile.has_completed_assessment = True
            profile.points += 500 # Completion bonus
        
        # Finalize the Error Profile report summary
        err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
        err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()
        
        if err_profile:
            err_profile.full_report = raw_audit
            err_profile.updated_at = datetime.utcnow()

        await self.db.commit()
        return raw_audit
