from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, Any

from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.schemas.evaluation import (
    StartAssessmentRequest, 
    AssessmentResponseItem, 
    EvaluationResponse
)
from app.services.assessment_service import AssessmentService

router = APIRouter()

@router.post("/start", response_model=Dict[str, Any])
async def start_assessment(
    request: StartAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Initializes a new assessment session.
    """
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

@router.post("/{assessment_id}/submit-answer", response_model=EvaluationResponse)
async def evaluate_response(
    assessment_id: UUID,
    item: AssessmentResponseItem,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Evaluates a single user response strictly via Groq LLM and persists it dynamically.
    """
    if str(item.user_id) != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if assessment_id != item.assessment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path ID mismatches payload")
        
    service = AssessmentService(db)
    try:
        response_envelope = await service.evaluate_response(item)
        return response_envelope
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
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
    service = AssessmentService(db)
    try:
        # Pass the validated token ID
        audit_report = await service.complete_assessment(assessment_id, UUID(current_user_id))
        return {
            "status": "completed",
            "audit_report": audit_report
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Assessment completion failed")
