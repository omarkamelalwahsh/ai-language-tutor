from pydantic import BaseModel, Field
from typing import List, Optional

class TaskOptionDTO(BaseModel):
    id: str
    title: str
    badge: Optional[str] = None
    task_type: str

class PracticeTasksResponse(BaseModel):
    skill: str
    tasks: List[TaskOptionDTO]

class PracticeStartRequest(BaseModel):
    skill: str
    task_type: str
    difficulty: str = Field(..., description="Difficulty level: easy, medium, or hard")

class PracticeStartResponse(BaseModel):
    session_id: str
    message: str
