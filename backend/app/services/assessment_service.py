from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select, update, func
from uuid import UUID, uuid4
import json
import logging
import traceback
from app.models.domain import Assessment, AssessmentResponse, AssessmentLog, AssessmentStatus, LearnerProfile, UserErrorProfile, UserErrorAnalysis, UserSkill
from app.schemas.evaluation import StartAssessmentRequest, AssessmentResponseItem, EvaluationResponse, NormalizedFields
from app.integrations.groq_client import evaluate_answer, audit_assessment, EVALUATION_MODE_OBJECTIVE, EVALUATION_MODE_OPEN_ENDED
from app.core.config import settings
from datetime import datetime

# ---------------------------------------------------------------------------
# Skills that use open-ended evaluation (70B model, CEFR quality grading)
# ---------------------------------------------------------------------------
OPEN_ENDED_SKILLS = {"speaking", "writing"}

def _determine_evaluation_mode(skill: str, prompt: str) -> str:
    """Determine if a question should be evaluated as objective or open-ended."""
    skill_lower = (skill or "").lower()
    prompt_lower = (prompt or "").lower()
    
    # Explicit open-ended signals
    if skill_lower in OPEN_ENDED_SKILLS:
        return EVALUATION_MODE_OPEN_ENDED
    if "recorded_monologue" in prompt_lower or "short_interaction_sim" in prompt_lower:
        return EVALUATION_MODE_OPEN_ENDED
    if "speak for" in prompt_lower or "write" in prompt_lower:
        return EVALUATION_MODE_OPEN_ENDED
    
    return EVALUATION_MODE_OBJECTIVE

def _compute_tiered_fallback_score(user_answer: str, evaluation_mode: str) -> float:
    """
    Tiered fallback scoring when LLM evaluation fails entirely.
    Based on response substance and evaluation mode.
    """
    answer_len = len((user_answer or "").strip())
    
    if answer_len == 0:
        return 0.1  # Empty / off-topic
    
    if evaluation_mode == EVALUATION_MODE_OPEN_ENDED:
        if answer_len >= 150:
            return 0.7   # Substantial open-ended response
        elif answer_len >= 50:
            return 0.6   # Moderate attempt
        else:
            return 0.55  # Short but present
    else:
        # Objective tasks: we can't guess correctness
        if answer_len >= 10:
            return 0.5
        else:
            return 0.4


class AssessmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_assessment(self, request: StartAssessmentRequest) -> Assessment:
        try:
            # Check if user profile exists, if not create one placeholder
            stmt = select(LearnerProfile).where(LearnerProfile.id == request.user_id)
            result = await self.db.execute(stmt)
            profile = result.scalar_one_or_none()
            
            if not profile:
                new_profile = LearnerProfile(
                    id=request.user_id, 
                    full_name="Learner", 
                    overall_level="Pending",
                    onboarding_complete=False
                )
                self.db.add(new_profile)
                await self.db.flush() # Ensure it's in the session
                
            assessment = Assessment(
                user_id=request.user_id,
                status=AssessmentStatus.in_progress.value
            )
            self.db.add(assessment)
            await self.db.commit()
            await self.db.refresh(assessment)
            return assessment
        except Exception as e:
            logging.error(f"Error in start_assessment: {str(e)}")
            logging.error(traceback.format_exc())
            await self.db.rollback()
            raise e

    async def get_latest_in_progress_assessment(self, user_id: UUID) -> Assessment:
        """ Fetches the most recent in-progress assessment for a user. """
        stmt = select(Assessment).where(
            Assessment.user_id == user_id,
            Assessment.status == AssessmentStatus.in_progress.value
        ).order_by(Assessment.created_at.desc()).limit(1)
        
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def evaluate_response(self, item: AssessmentResponseItem) -> EvaluationResponse:
        """
        Evaluates a single question answer via Groq LLM with TYPE-AWARE routing.
        - Objective tasks (MCQ/reading/listening) -> 8B fast model
        - Open-ended tasks (speaking/writing) -> 70B deep model with CEFR grading
        """
        try:
            # 1. Fetch the assessment context
            stmt = select(Assessment).where(Assessment.id == item.assessment_id).where(Assessment.user_id == item.user_id)
            result = await self.db.execute(stmt)
            assessment = result.scalar_one_or_none()
            if not assessment:
                raise ValueError("Assessment not found or unauthorized")
            
            if assessment.status != AssessmentStatus.in_progress.value:
                raise ValueError("Assessment is already finished.")

            # 2. Determine evaluation mode
            evaluation_mode = _determine_evaluation_mode(item.skill, item.prompt)
            
            # 3. Set expected answer based on mode
            if evaluation_mode == EVALUATION_MODE_OPEN_ENDED:
                expected_answer = None  # No reference answer for open-ended
            else:
                expected_answer = "OPEN ENDED"  # Fallback; ideally from question bank
            
            # 4. Call Groq with the correct model and prompt
            raw_json, model_used = await evaluate_answer(
                prompt=item.prompt,
                expected_answer=expected_answer,
                user_answer=item.user_answer,
                current_level=item.current_band,
                evaluation_mode=evaluation_mode,
                history="[]"
            )

            # 5. Extract structured scores (new format)
            overall_score = float(raw_json.get("overall_score", raw_json.get("score", 0.0)))
            task_completion = float(raw_json.get("task_completion_score", overall_score))
            language_quality = float(raw_json.get("language_quality_score", overall_score))
            is_correct = bool(raw_json.get("is_correct", overall_score >= 0.5))
            predicted_level = raw_json.get("detected_level", item.current_band)
            confidence = float(raw_json.get("confidence_score", raw_json.get("confidence", 0.5)))

            # Use overall_score as the canonical score
            score = overall_score

            # 6. ATOMIC UPSERT into assessment_responses
            difficulty_val = raw_json.get("difficulty", 0.5)
            if not raw_json.get("difficulty") and hasattr(item, 'difficulty'):
                difficulty_val = item.difficulty

            insert_stmt = insert(AssessmentResponse).values(
                id=uuid4(),
                assessment_id=item.assessment_id,
                user_id=item.user_id,
                question_id=item.question_id,
                user_answer=item.user_answer,
                is_correct=is_correct,
                score=score,
                answer_level=predicted_level,
                difficulty=difficulty_val,
                raw_evaluation=raw_json,
                explanation=raw_json,
                skill=item.skill,
                status="completed",
                response_time_ms=0,
                created_at=func.now()
            )
            
            upsert_stmt = insert_stmt.on_conflict_do_update(
                constraint='uq_assessment_question',
                set_={
                    'user_answer': insert_stmt.excluded.user_answer,
                    'is_correct': insert_stmt.excluded.is_correct,
                    'score': insert_stmt.excluded.score,
                    'answer_level': insert_stmt.excluded.answer_level,
                    'difficulty': insert_stmt.excluded.difficulty,
                    'raw_evaluation': insert_stmt.excluded.raw_evaluation
                }
            )
            await self.db.execute(upsert_stmt)

            # 6b. Record detailed log in assessment_logs table
            new_log = AssessmentLog(
                id=uuid4(),
                assessment_id=item.assessment_id,
                user_id=item.user_id,
                question=item.prompt,
                question_text=item.stimulus,
                user_answer=item.user_answer,
                correct_answer=raw_json.get("correct_answer", ""),
                is_correct=is_correct,
                skill=item.skill,
                category=item.skill,
                score=score,
                difficulty=difficulty_val,
                response_time_ms=0,
                duration_ms=0,
                question_level=item.current_band,
                level=predicted_level,
                status="completed",
                evaluation_metadata=raw_json,
                metadata_field={"source": "api_evaluate", "evaluation_mode": evaluation_mode, "model": model_used}
            )
            self.db.add(new_log)

            # 7. MULTI-SKILL TRACKING: Update skill_states table
            # Primary Skill
            primary_skill = (item.skill or "general").lower()
            
            # Sub-skills for Inference (Speaking/Writing only)
            inferred_skills = []
            if primary_skill in OPEN_ENDED_SKILLS:
                if "vocabulary_score" in raw_json:
                    inferred_skills.append(("vocabulary", float(raw_json["vocabulary_score"])))
                if "grammar_score" in raw_json:
                    inferred_skills.append(("grammar", float(raw_json["grammar_score"])))

            # 🚀 Unified Skill Sync Loop
            for s_name, s_score in [(primary_skill, score)] + inferred_skills:
                skill_stmt = select(UserSkill).where(
                    UserSkill.user_id == item.user_id,
                    UserSkill.skill == s_name
                )
                skill_record = (await self.db.execute(skill_stmt)).scalar_one_or_none()
                
                if not skill_record:
                    skill_record = UserSkill(
                        user_id=item.user_id,
                        skill=s_name,
                        category=s_name.capitalize(),
                        xp_points=0,
                        current_score=0.0,
                        current_proficiency_level="A1",
                        proficiency_confidence=0.0,
                        stability_buffer=[]
                    )
                    self.db.add(skill_record)
                    await self.db.flush()
                
                # A. XP & Score (Basis Points: 0-10000)
                is_this_correct = s_score >= 0.5
                base_xp = 5 if is_this_correct else -2
                skill_record.xp_points = max(0, (skill_record.xp_points or 0) + base_xp)
                
                # Update current_score (0-10000 BP)
                # s_score is 0-1.0, so 0.82 -> 8200
                new_bp = int(s_score * 10000)
                # Weighted average for stability or just take the new high if credible?
                # For now, we take max(current, new) for diagnostic phase or weighted average for learning phase.
                # Diagnostic mode: we want the highest credible evidence.
                if confidence >= 0.7:
                    skill_record.current_score = max(skill_record.current_score or 0.0, float(new_bp))
                
                # B. CEFR Window (Proficiency Engine)
                if confidence >= 0.7:
                    buffer = list(getattr(skill_record, 'stability_buffer', []) or [])
                    buffer.append(predicted_level)
                    buffer = buffer[-3:]
                    skill_record.stability_buffer = buffer
                    
                    valid_levels = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
                    curr_val = valid_levels.get(skill_record.current_proficiency_level or "A1", 0)
                    new_val = valid_levels.get(predicted_level, 0)
                    
                    # Upgrade quickly if higher capability is demonstrated
                    if new_val > curr_val:
                        skill_record.current_proficiency_level = predicted_level
                        skill_record.current_level = predicted_level # Legacy
                        skill_record.proficiency_confidence = max(skill_record.proficiency_confidence or 0.0, confidence)
                    # Downgrade slowly only if 3 consecutive answers are lower
                    elif new_val < curr_val and len(buffer) == 3 and len(set(buffer)) == 1:
                        skill_record.current_proficiency_level = predicted_level
                        skill_record.current_level = predicted_level # Legacy

            # 8. REAL-TIME ERROR ANALYSIS: If incorrect, record it immediately
            if not is_correct:
                err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == item.user_id)
                err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()
                
                if not err_profile:
                    err_profile = UserErrorProfile(id=uuid4(), user_id=item.user_id, full_report={})
                    self.db.add(err_profile)
                    await self.db.flush() 

                analysis = UserErrorAnalysis(
                    id=uuid4(),
                    profile_id=err_profile.id,
                    user_id=item.user_id,
                    question_id=item.question_id,
                    category=item.skill,
                    user_answer=item.user_answer,
                    is_correct=False,
                    ai_interpretation=raw_json.get("feedback", raw_json.get("reasoning_summary", "No specific error detected")),
                    question_number=item.question_number
                )
                self.db.add(analysis)

            # 9. Increment Progression
            if item.question_number >= assessment.current_index:
                assessment.current_index = item.question_number + 1

            # 10. Check for Auto-Completion
            await self.db.commit()
            
            # 🛑 NEVER GUESS COMPLETION: Only proceed if it is explicitly the last question
            if getattr(item, 'is_last_question', False):
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
        except Exception as e:
            logging.error(f"[evaluate_response] Error: {str(e)}")
            logging.error(traceback.format_exc())
            
            # Tiered fallback
            evaluation_mode = _determine_evaluation_mode(item.skill, item.prompt)
            fallback_score = _compute_tiered_fallback_score(item.user_answer, evaluation_mode)
            
            return EvaluationResponse(
                assessment_id=item.assessment_id,
                question_id=item.question_id,
                evaluation_model="error-fallback",
                result={
                    "error": str(e), 
                    "is_fallback": True, 
                    "feedback": "Service temporarily unavailable. Assessment continues.",
                    "evaluation_mode": evaluation_mode,
                    "overall_score": fallback_score
                },
                normalized_fields=NormalizedFields(
                    is_correct=fallback_score >= 0.6,
                    score=fallback_score,
                    predicted_level=item.current_band
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

        # Run Audit Evaluation (Groq 70B) - expensive but necessary for final placement
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
            # final_audit_overrides_session_anchoring = True
            profile.current_proficiency_level = final_level
            profile.overall_level = final_level  # Legacy
            profile.has_completed_assessment = True
            profile.onboarding_complete = True
            
            # Separation of XP from Proficiency evaluation
            profile.xp_points = (getattr(profile, 'xp_points', 0) or 0) + 500  # Completion Bonus
            profile.points = (profile.points or 0) + 500  # Legacy
            
            # Link the learning journey if one exists
            from app.models.domain import LearningJourney
            journey_stmt = select(LearningJourney).where(LearningJourney.user_id == user_id)
            journey = (await self.db.execute(journey_stmt)).scalar_one_or_none()
            if journey:
                profile.current_journey_id = str(journey.id)
        
        # Finalize the Error Profile report summary
        err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
        err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()
        
        if err_profile:
            err_profile.full_report = raw_audit
            err_profile.weakness_areas = raw_audit.get("weakness_areas", [])
            err_profile.common_mistakes = raw_audit.get("common_mistakes", [])
            err_profile.action_plan = raw_audit.get("action_plan", "Generating your path...")
            err_profile.updated_at = datetime.utcnow()

        await self.db.commit()
        return raw_audit
