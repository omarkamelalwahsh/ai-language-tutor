from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct, desc
from typing import List
import random
from uuid import UUID
from datetime import datetime, timezone

from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.models.domain import QuestionBankItem, AssessmentResponse, Assessment, AssessmentStatus
from app.schemas.practice import PracticeTasksResponse, TaskOptionDTO, PracticeStartRequest, PracticeStartResponse

router = APIRouter()

# Helper to format task titles nicely
def format_task_title(task_type: str) -> str:
    # Example: 'reading_comprehension' -> 'Reading Comprehension'
    words = task_type.replace('_', ' ').split()
    return ' '.join(word.capitalize() for word in words)

# Predefined pedagogical tasks mapping to DB task types
PREDEFINED_TASKS = {
    "reading": [
        {"id": "skimming", "title": "Skimming", "db_task_type": "reading_comprehension"},
        {"id": "deep_analysis", "title": "Deep Analysis", "db_task_type": "reading_comprehension"},
        {"id": "vocabulary_quiz", "title": "Vocabulary Quiz", "db_task_type": "vocabulary"}
    ],
    "listening": [
        {"id": "main_idea", "title": "Main Idea Extraction", "db_task_type": "listening_comprehension"},
        {"id": "detail_recognition", "title": "Detail Recognition", "db_task_type": "listening_comprehension"},
        {"id": "tone_analysis", "title": "Tone Analysis", "db_task_type": "listening_comprehension"}
    ],
    "writing": [
        {"id": "email_drafting", "title": "Email Drafting", "db_task_type": "essay"},
        {"id": "essay_structuring", "title": "Essay Structuring", "db_task_type": "essay"},
        {"id": "grammar_drills", "title": "Grammar Drills", "db_task_type": "grammar"}
    ],
    "speaking": [
        {"id": "pronunciation", "title": "Pronunciation Check", "db_task_type": "speaking"},
        {"id": "fluency", "title": "Fluency Practice", "db_task_type": "speaking"},
        {"id": "roleplay", "title": "Roleplay Scenario", "db_task_type": "speaking"}
    ]
}

@router.get("/skills/{skill}/tasks", response_model=PracticeTasksResponse)
async def get_practice_tasks(
    skill: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Fetch available task types for a skill and compute 'Review Needed' or 'New' badges.
    """
    skill_key = skill.lower()
    tasks_list = PREDEFINED_TASKS.get(skill_key, [])
    
    if not tasks_list:
        # Fallback if skill doesn't match predefined
        tasks_list = [{"id": "general", "title": "General Practice", "db_task_type": skill_key}]
    
    tasks_dto = []
    
    for task in tasks_list:
        badge = None
        t_type = task["db_task_type"]
        
        # Check last 5 attempts for this user, skill and task_type
        recent_attempts_stmt = (
            select(AssessmentResponse.is_correct)
            .join(QuestionBankItem, AssessmentResponse.question_id == QuestionBankItem.id)
            .where(
                AssessmentResponse.user_id == UUID(user_id),
                QuestionBankItem.skill == skill_key,
                QuestionBankItem.task_type == t_type
            )
            .order_by(desc(AssessmentResponse.created_at))
            .limit(5)
        )
        recent_result = await db.execute(recent_attempts_stmt)
        attempts = recent_result.scalars().all()
        
        if not attempts:
            badge = "New"
        else:
            # Calculate accuracy rate
            correct_count = sum(1 for a in attempts if a is True)
            accuracy_rate = correct_count / len(attempts)
            
            if accuracy_rate < 0.60:
                badge = "Review Needed"
            elif accuracy_rate >= 0.80 and len(attempts) >= 3:
                badge = "Mastered"

        # Check if completed today
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_stmt = (
            select(AssessmentResponse.id)
            .join(QuestionBankItem, AssessmentResponse.question_id == QuestionBankItem.id)
            .where(
                AssessmentResponse.user_id == UUID(user_id),
                QuestionBankItem.skill == skill_key,
                QuestionBankItem.task_type == t_type,
                AssessmentResponse.created_at >= today_start
            )
            .limit(1)
        )
        today_result = await db.execute(today_stmt)
        completed_today = today_result.scalar_one_or_none() is not None

        tasks_dto.append(TaskOptionDTO(
            id=task["id"], # UI uses this specific ID
            title=task["title"],
            task_type=t_type, # Backend will use this for starting session
            badge=badge,
            completed_today=completed_today
        ))
        
    return PracticeTasksResponse(skill=skill, tasks=tasks_dto)

@router.post("/start", response_model=PracticeStartResponse)
async def start_practice_session(
    request: PracticeStartRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Start a new practice session based on skill, task_type, and difficulty.
    Hybrid Difficulty Mapping:
    - Easy: A1-A2
    - Medium: B1-B2
    - Hard: C1-C2
    Within those levels, order by float difficulty.
    """
    level_mapping = {
        "easy": ["A1", "A2"],
        "medium": ["B1", "B2"],
        "hard": ["C1", "C2"]
    }
    
    target_levels = level_mapping.get(request.difficulty.lower(), ["B1", "B2"])
    
    # Query questions
    stmt = (
        select(QuestionBankItem)
        .where(
            QuestionBankItem.skill == request.skill.lower(),
            QuestionBankItem.task_type == request.task_type,
            QuestionBankItem.level.in_(target_levels)
        )
        .order_by(QuestionBankItem.difficulty.asc()) # Order from easiest to hardest inside the level bracket
        .limit(10) # 10 questions per practice session
    )
    
    result = await db.execute(stmt)
    questions = result.scalars().all()
    
    if not questions:
        # Fallback to any difficulty if exact match isn't found for the task type
        fallback_stmt = (
            select(QuestionBankItem)
            .where(
                QuestionBankItem.skill == request.skill.lower(),
                QuestionBankItem.task_type == request.task_type
            )
            .limit(10)
        )
        result = await db.execute(fallback_stmt)
        questions = result.scalars().all()
        
        if not questions:
            raise HTTPException(status_code=404, detail="No questions available for this configuration.")

    # Create Assessment Session
    new_assessment = Assessment(
        user_id=UUID(user_id),
        status=AssessmentStatus.in_progress.value,
        total_questions=len(questions),
        evaluation_metadata={"type": "practice", "difficulty_bracket": request.difficulty}
    )
    db.add(new_assessment)
    await db.flush() # To get the assessment ID
    
    # Create Assessment Responses (placeholders)
    for q in questions:
        resp = AssessmentResponse(
            assessment_id=new_assessment.id,
            user_id=UUID(user_id),
            question_id=q.id,
            status="pending",
            skill=q.skill,
            category=q.task_type
        )
        db.add(resp)
        
    await db.commit()
    
    return PracticeStartResponse(
        session_id=str(new_assessment.id),
        message="Practice session created successfully"
    )
