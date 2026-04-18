import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, Any, Union

from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.evaluation import (
    StartAssessmentRequest, 
    AssessmentResponseItem, 
    EvaluationResponse
)
from app.services.assessment_service import AssessmentService
from app.models.domain import Assessment, AssessmentResponse, AssessmentStatus
from sqlalchemy import select

router = APIRouter()

@router.get("/latest/responses")
async def get_latest_assessment_responses(
    userId: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches responses for the user's most recent completed assessment.
    Used by the AssessmentReviewView to render the detailed report.
    """
    try:
        user_uuid = UUID(userId)

        # Find latest completed assessment for this user
        stmt = (
            select(Assessment)
            .where(Assessment.user_id == user_uuid)
            .where(Assessment.status == AssessmentStatus.completed.value)
            .order_by(Assessment.completed_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        assessment = result.scalar_one_or_none()

        if not assessment:
            return {"responses": [], "assessment_id": None}

        # Fetch all responses for this assessment
        resp_stmt = (
            select(AssessmentResponse)
            .where(AssessmentResponse.assessment_id == assessment.id)
            .order_by(AssessmentResponse.created_at.asc())
        )
        resp_result = await db.execute(resp_stmt)
        responses = resp_result.scalars().all()

        return {
            "assessment_id": str(assessment.id),
            "responses": [
                {
                    "question_id": str(r.question_id),
                    "user_answer": r.user_answer,
                    "is_correct": r.is_correct,
                    "score": r.score,
                    "answer_level": r.answer_level or "A1",
                    "explanation": r.explanation or r.raw_evaluation or {},
                    "skill": r.skill or "general",
                    "prompt": (r.raw_evaluation or {}).get("prompt", ""),
                }
                for r in responses
            ]
        }
    except Exception as e:
        logging.error(f"Error in get_latest_assessment_responses: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start", response_model=Dict[str, Any])
async def start_assessment(
    request: StartAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Initializes a new assessment session.
    """
    try:
        # Enforce request identity matches the token identity
        if str(request.user_id) != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot start assessment for a different user"
            )
        
        service = AssessmentService(db)
        assessment = await service.start_assessment(request)
        
        return {
            "assessment_id": str(assessment.id),
            "status": assessment.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in start_assessment route: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{assessment_id}/submit-answer", response_model=EvaluationResponse)
async def evaluate_response(
    assessment_id: Union[UUID, str],
    item: AssessmentResponseItem,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Evaluates a single user response strictly via Groq LLM and persists it dynamically.
    Handles 'pending-sync' as a valid temporary state.
    """
    try:
        service = AssessmentService(db)
        
        # Check if assessment_id is 'pending-sync'
        if str(assessment_id) == "pending-sync" or str(item.assessment_id) == "pending-sync":
            logging.warning(f"Submission received with pending-sync for user {current_user_id}. Attempting to resolve...")
            
            # Fallback: Find the latest in-progress assessment for this user
            resolved_assessment = await service.get_latest_in_progress_assessment(UUID(current_user_id))
            if resolved_assessment:
                logging.info(f"Resolved pending-sync to assessment_id: {resolved_assessment.id}")
                assessment_id = resolved_assessment.id
                item.assessment_id = resolved_assessment.id # Important for the payload used by service
            else:
                logging.error(f"Failed to resolve pending-sync for user {current_user_id}. No active assessment found.")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Assessment session not found. Please refresh."
                )

        if str(item.user_id) != current_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        
        # Path validation
        try:
            path_uuid = UUID(str(assessment_id))
            item_uuid = UUID(str(item.assessment_id))
            if path_uuid != item_uuid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path ID mismatches payload")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid UUID format after sync check")
            
        service = AssessmentService(db)
        response_envelope = await service.evaluate_response(item)
        return response_envelope
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logging.error(f"Error in submit-answer route: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Evaluation failed")

@router.post("/{assessment_id}/complete")
async def complete_assessment(
    assessment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Finalizes the assessment and generates the comprehensive CEFR report.
    """
    try:
        service = AssessmentService(db)
        # Pass the validated token ID
        audit_report = await service.complete_assessment(assessment_id, UUID(current_user_id))
        
        from app.models.domain import LearnerProfile
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == UUID(current_user_id))
        profile = (await db.execute(prof_stmt)).scalar_one_or_none()
        
        return {
            "status": "completed",
            "gamification_data": {
                "xp_points": profile.xp_points if profile else 0,
                "streak": getattr(profile, 'streak', 0) if profile else 0
            },
            "proficiency_data": {
                "final_cefr_level": audit_report.get("final_cefr_level", getattr(profile, 'current_proficiency_level', "A1")),
                "skills_breakdown": audit_report.get("skills_breakdown", {}),
                "reasoning": audit_report.get("reasoning", ""),
                "audit_report": audit_report
            }
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logging.error(f"Error in complete assessment route: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Assessment completion failed")
