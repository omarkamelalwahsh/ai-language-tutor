from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.db.database import get_db
from app.services.task_generator import TaskGenerator
from app.services.session_manager import SessionManager
from app.integrations.groq_client import evaluate_dynamic_task
from app.services.pedagogy import PedagogyService

router = APIRouter()


# ---------------------------------------------------------------------------
# Legacy single-task endpoint (kept for compatibility)
# ---------------------------------------------------------------------------
@router.post("/generate", response_model=Dict[str, Any])
async def generate_task(
    type: str = Body(..., embed=True),
    skill_type: Optional[str] = Body(None, embed=True),
    target_level: Optional[str] = Body(None, embed=True),
    chosen_domain: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate a single personalized task for the current user."""
    if not type:
        raise HTTPException(status_code=400, detail="Task type is required")
    try:
        user_id = current_user["sub"]
        task = await TaskGenerator.generate_task(
            user_id=user_id,
            task_type=type,
            db=db,
            skill_type=skill_type,
            target_level=target_level,
            chosen_domain=chosen_domain,
        )
        return JSONResponse(content=task, headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate task: {str(e)}")


# ---------------------------------------------------------------------------
# Smart Daily Mix — 5 tasks (review × 2, journey × 2, maintenance × 1)
# ---------------------------------------------------------------------------
@router.post("/daily-mix", response_model=Dict[str, Any])
async def build_daily_mix(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Builds the Smart Daily Mix for the current user.
    Uses the canonical JourneyMap → JourneyNode → JourneyTask runtime tables
    as the sole source of truth for the active journey context, then asks the
    AI architect to generate 5 hyper-personalized tasks.
    """
    try:
        user_id = current_user["sub"]
        mix = await SessionManager.build_daily_mix(user_id=user_id, db=db)
        return JSONResponse(content={
            **mix,
            "runtime_source": "journey_maps/nodes/journey_tasks",
        }, headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build daily mix: {str(e)}")


# ---------------------------------------------------------------------------
# Targeted Skill Practice — 5 progressive tasks on one specific skill
# ---------------------------------------------------------------------------
class SkillPracticeRequest(BaseModel):
    skill: str = Field(..., description="writing | reading | listening | speaking | grammar | vocabulary")
    task_type: Optional[str] = Field(None, description="Optional specific task type (e.g. visual_vocabulary)")
    count: int = Field(5, ge=1, le=10)


@router.post("/skill-practice", response_model=Dict[str, Any])
async def build_skill_practice(
    payload: SkillPracticeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generates a progressive ladder of tasks targeting one chosen skill."""
    try:
        user_id = current_user["sub"]
        return await SessionManager.build_skill_practice(
            user_id=user_id, 
            skill=payload.skill.lower(), 
            db=db, 
            count=payload.count,
            task_type=payload.task_type
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build skill practice: {str(e)}")


# ---------------------------------------------------------------------------
# Feedback Loop — write the session results back into the DB
# ---------------------------------------------------------------------------
class TaskResult(BaseModel):
    skill: Optional[str] = None
    score: float = 0.0
    is_correct: bool = False
    task_metadata: Optional[Dict[str, Any]] = None
    error_category: Optional[str] = None


class SessionCompletePayload(BaseModel):
    session_type: str = Field(..., description="daily_mix | skill_practice")
    results: List[TaskResult]
    completed_journey_step_id: Optional[str] = None


@router.post("/session-complete", response_model=Dict[str, Any])
async def session_complete(
    payload: SessionCompletePayload,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Closes a session: updates skill_states, learner_profiles,
    user_error_profiles, and advances the active journey step if passed.
    """
    try:
        user_id = current_user["sub"]
        return await SessionManager.process_session_results(
            user_id=user_id,
            session_data=payload.model_dump(),
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process session results: {str(e)}")


@router.post("/sync-task", response_model=Dict[str, Any])
async def sync_task(
    payload: TaskResult,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Syncs a single task result immediately. Used for 'Zero-Data-Loss' strategy.
    Updates learner profile and error profile incrementally.
    """
    try:
        user_id = current_user["sub"]
        return await SessionManager.sync_task_result(
            user_id=user_id,
            result=payload.model_dump(),
            db=db,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync task result: {str(e)}")


# ---------------------------------------------------------------------------
# CEFR Evaluator — grades a single learner response with the upgraded prompt
# ---------------------------------------------------------------------------
class EvaluateTaskMetadata(BaseModel):
    type: Optional[str] = "OPEN_RESPONSE"
    skill: Optional[str] = "general"
    level: Optional[str] = "B1"
    difficulty_score: Optional[float] = 0.5


class EvaluateTaskContent(BaseModel):
    instruction: Optional[str] = ""
    stimulus: Optional[str] = ""
    task_prompt: Optional[str] = ""
    target_response: Optional[Union[str, List[str]]] = ""
    explanation: Optional[str] = ""


class EvaluateTaskRequest(BaseModel):
    task_metadata: EvaluateTaskMetadata
    content: EvaluateTaskContent
    user_response: str
    session_id: Optional[str] = None
    task_id: Optional[str] = None


@router.post("/evaluate-task", response_model=Dict[str, Any])
async def evaluate_task(
    payload: EvaluateTaskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Grades one learner response using the CEFR-aware Evaluator.
    Now with Incremental Write (sync_task_result).
    """
    try:
        user_id = current_user["sub"]
        
        # 1. AI Evaluation
        result, _ = await evaluate_dynamic_task(
            prompt=payload.content.task_prompt or payload.content.instruction or "",
            rubric={
                "target_response": payload.content.target_response,
                "explanation": payload.content.explanation,
                "stimulus": payload.content.stimulus,
            },
            user_response=payload.user_response,
            task_type=payload.task_metadata.type or "OPEN_RESPONSE",
            skill=payload.task_metadata.skill or "general",
            user_level=payload.task_metadata.level or "B1",
            difficulty=payload.task_metadata.difficulty_score or 0.5,
            stimulus=payload.content.stimulus or "",
            target_response=payload.content.target_response or "",
            explanation=payload.content.explanation or "",
        )
        
        # 2. Sync to DB (Incremental Write)
        sync_payload = {
            "skill": payload.task_metadata.skill,
            "is_correct": result.get("is_correct", False),
            "score": result.get("score", 0.0),
            "error_category": result.get("error_analysis", {}).get("error_category"),
            "task_metadata": {
                "id": payload.task_id,
                "type": payload.task_metadata.type,
                "slot_role": "targeted" # Default for skill practice
            }
        }
        sync_res = await SessionManager.sync_task_result(user_id, sync_payload, db)
        
        # Merge evaluation and sync state
        final_result = {**result, "sync_state": sync_res}
        
        # [NEW] Phase 4: Smart Hint Integration
        if not result.get("is_correct", False):
            error_cat = result.get("error_category", payload.task_metadata.skill or "general")
            hint = PedagogyService.get_smart_hint(error_cat)
            final_result["pedagogical_hint"] = hint
            
        return final_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate task: {str(e)}")
