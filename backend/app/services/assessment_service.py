from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import json
from app.models.domain import Assessment, AssessmentResponse, AssessmentStatus, LearnerProfile, UserErrorProfile, UserErrorAnalysis
from app.schemas.evaluation import StartAssessmentRequest, AssessmentResponseItem, EvaluationResponse, NormalizedFields
from app.integrations.groq_client import evaluate_answer, audit_assessment
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
        Evaluates a single question answer via Groq LLM, stores the raw response,
        and returns the unified response envelope to the client.
        """
        # Fetch the assessment to ensure valid
        stmt = select(Assessment).where(Assessment.id == item.assessment_id).where(Assessment.user_id == item.user_id)
        result = await self.db.execute(stmt)
        assessment = result.scalar_one_or_none()
        if not assessment:
            raise ValueError("Assessment not found or unauthorized")

        # In a real scenario, fetch the question from the DB to get the expected answer safely.
        # But here we rely on the prompt from the payload (or ideally look it up).
        # We will use the expected answer if provided, or "OPEN ENDED"
        expected_answer = "OPEN ENDED" # Can be extended to fetch from QuestionBankItem

        # Call Groq
        raw_json, model_used = await evaluate_answer(
            prompt=item.prompt,
            expected_answer=expected_answer,
            user_answer=item.user_answer,
            current_level=item.current_band,
            history="[]"  # Extend to pass real history if needed
        )

        # Extract normalized fields safely
        score = float(raw_json.get("score", 0.0))
        is_correct = bool(raw_json.get("is_correct", False))
        predicted_level = raw_json.get("detected_level", item.current_band)

        # Persist response
        response_record = AssessmentResponse(
            assessment_id=item.assessment_id,
            user_id=item.user_id,
            question_id=item.question_id,
            user_answer=item.user_answer,
            is_correct=is_correct,
            score=score,
            answer_level=predicted_level,
            raw_evaluation=raw_json,
            skill=item.skill
        )
        self.db.add(response_record)
        await self.db.commit()

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
        Completes the assessment, performs final auditing via Groq,
        and updates the user profile and error analysis tables.
        """
        stmt = select(Assessment).where(Assessment.id == assessment_id).where(Assessment.user_id == user_id)
        result = await self.db.execute(stmt)
        assessment = result.scalar_one_or_none()
        
        if not assessment:
            raise ValueError("Assessment not found")
        if assessment.status == AssessmentStatus.completed.value:
            raise ValueError("Assessment already completed")

        # Fetch all responses for the history context
        resp_stmt = select(AssessmentResponse).where(AssessmentResponse.assessment_id == assessment_id)
        responses = (await self.db.execute(resp_stmt)).scalars().all()
        
        history_context = []
        for r in responses:
            history_context.append({
                "skill": r.skill,
                "answer": r.user_answer,
                "is_correct": r.is_correct,
                "score": r.score
            })

        # Run Audit Evaluation (Groq)
        raw_audit, model_used = await audit_assessment(json.dumps(history_context))
        
        final_level = raw_audit.get("final_cefr_level", "Unknown")

        # Update assessment
        assessment.status = AssessmentStatus.completed.value
        assessment.completed_at = datetime.utcnow()
        assessment.evaluation_metadata = raw_audit
        
        # Update Profile
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
        if profile:
            profile.overall_level = final_level
            profile.has_completed_assessment = True
        
        # Upsert Error Profile
        err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
        err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()
        
        if not err_profile:
            err_profile = UserErrorProfile(user_id=user_id, full_report=raw_audit)
            self.db.add(err_profile)
            await self.db.flush()
        else:
            err_profile.full_report = raw_audit
            err_profile.updated_at = datetime.utcnow()

        # Add error analysis rows
        error_list = raw_audit.get("error_analysis", [])
        for err in error_list:
            analysis = UserErrorAnalysis(
                profile_id=err_profile.id,
                user_id=user_id,
                category=err.get("category", ""),
                user_answer=err.get("user_answer", ""),
                correct_answer=err.get("correct_answer", ""),
                deep_insight=err.get("explanation", ""),
                is_correct=False
            )
            self.db.add(analysis)

        await self.db.commit()
        return raw_audit
