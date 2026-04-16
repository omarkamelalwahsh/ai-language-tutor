from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime

class NormalizedFields(BaseModel):
    is_correct: bool
    score: float
    predicted_level: str

class EvaluationResponse(BaseModel):
    """
    Standard envelope designed to keep the dynamic Groq evaluation output intact 
    while extracting necessary normalized fields.
    """
    assessment_id: UUID
    question_id: UUID
    evaluation_source: str = "groq"
    evaluation_model: str
    evaluation_version: str = "v1"
    
    # The actual output dict from the LLM, untouched
    result: Dict[str, Any]
    
    # Normalized fields for strict product needs
    normalized_fields: NormalizedFields
    
    metadata: Dict[str, Any] = {}

class StartAssessmentRequest(BaseModel):
    user_id: UUID
    # Optionally specify a goal, topics
    goal: Optional[str] = None
    preferred_topics: Optional[List[str]] = None

class AssessmentResponseItem(BaseModel):
    user_id: UUID
    assessment_id: UUID
    question_id: UUID
    user_answer: str
    is_mcq: bool = False
    
    # Additional context for LLM if necessary
    skill: str
    current_band: str
    prompt: str
    stimulus: Optional[str] = None
    is_last_question: bool = False

class ErrorAnalysisReport(BaseModel):
    category: str
    issue: str
    user_answer: str
    correct_answer: str
    explanation: str

class CompletionAuditorResult(BaseModel):
    final_cefr_level: str
    overall_score: float
    diagnosis_report: str
    is_consistent: bool
    skills_breakdown: Dict[str, Any]
    error_analysis: List[ErrorAnalysisReport]
