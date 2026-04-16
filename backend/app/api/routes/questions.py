from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from app.db.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.domain import QuestionBankItem
import random

router = APIRouter()

def format_question(item):
    """Standardize question format for legacy frontend compatibility."""
    # Logic to handle options/answer_key which are JSONB in DB but might need parsing
    options = item.options if item.options else []
    
    return {
        "id": str(item.id),
        "skill": str(item.skill or 'vocabulary').lower(),
        "task_type": item.task_type or 'essay',
        "level": item.level or 'A1',
        "difficulty": float(item.difficulty or 0.5),
        "response_mode": "mcq" if (item.task_type and 'mcq' in item.task_type) or (options and len(options) > 0) else "typed",
        "prompt": item.prompt or 'Untitled Question',
        "stimulus": item.stimulus or '',
        "audio_url": getattr(item, 'audio_url', None),
        "options": options,
        "answer_key": item.answer_key if item.answer_key else {}
    }

@router.get("")
async def get_questions(
    type: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    is_diagnostic = type == 'diagnostic'
    
    try:
        if not is_diagnostic:
            stmt = select(QuestionBankItem)
            result = await db.execute(stmt)
            items = result.scalars().all()
            return [format_question(i) for i in items]

        # --- STRICT DIAGNOSTIC BLUEPRINT (40 Questions) ---
        distribution = [
            {'skill': 'grammar',    'easy': 4, 'medium': 4, 'hard': 4},
            {'skill': 'listening',  'easy': 2, 'medium': 4, 'hard': 2},
            {'skill': 'reading',    'easy': 2, 'medium': 4, 'hard': 2},
            {'skill': 'vocabulary', 'easy': 1, 'medium': 2, 'hard': 1},
            {'skill': 'writing',    'easy': 1, 'medium': 2, 'hard': 1},
            {'skill': 'speaking',   'easy': 1, 'medium': 2, 'hard': 1}
        ]

        battery = []
        
        for d in distribution:
            stmt = select(QuestionBankItem).where(QuestionBankItem.skill == d['skill'])
            result = await db.execute(stmt)
            pool = result.scalars().all()
            
            easy = [q for q in pool if float(q.difficulty or 0.5) <= 0.3]
            medium = [q for q in pool if 0.3 < float(q.difficulty or 0.5) <= 0.7]
            hard = [q for q in pool if float(q.difficulty or 0.5) > 0.7]
            
            random.shuffle(easy)
            random.shuffle(medium)
            random.shuffle(hard)
            
            battery.extend(easy[:d['easy']])
            battery.extend(medium[:d['medium']])
            battery.extend(hard[:d['hard']])

        # Sort by difficulty: EASY -> MEDIUM -> HARD
        battery.sort(key=lambda x: float(x.difficulty or 0.5))
        
        return [format_question(q) for q in battery]

    except Exception as e:
        print(f"Error fetching questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Depends
