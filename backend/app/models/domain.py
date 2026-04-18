import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, Integer, ForeignKey, DateTime, Enum, text, func
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base

import enum

class TaskType(str, enum.Enum):
    mcq = "mcq"
    typed = "typed"
    audio = "audio"

class AssessmentStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    abandoned = "abandoned"

class User(Base):
    """Supabase Auth Users Table Mapping (Read-only for most cases or managed via trigger)"""
    __tablename__ = "users"
    __table_args__ = {'schema': 'auth'}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String)

class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String)
    overall_level = Column(String, default="A1")
    onboarding_complete = Column(Boolean, default=False)
    has_completed_assessment = Column(Boolean, default=False)
    
    # --- DEPRECATED: points --- 
    # Use xp_points instead. Kept for backward compatibility.
    points = Column(Integer, default=0)
    
    # --- New Fields for Decoupled System ---
    xp_points = Column(Integer, default=0) 
    current_proficiency_level = Column(String, default="A1")
    proficiency_confidence = Column(Float, default=0.0)
    stability_buffer = Column(JSONB, server_default='[]')
    
    current_journey_id = Column(String)
    
    # Frontend Metadata & Personalization
    focus_skills = Column(JSONB, server_default='[]') 
    learning_goal = Column(String)
    goal_context = Column(String)
    learning_topics = Column(JSONB, server_default='[]')
    session_intensity = Column(String)
    native_language = Column(String)
    target_language = Column(String)
    
    # Performance Metrics
    streak = Column(Integer, server_default='0')
    pacing_score = Column(Float, server_default='0.0')
    accuracy_rate = Column(Float, server_default='0.0')
    self_correction_rate = Column(Float, server_default='0.0')
    confidence_style = Column(String)
    
    # Extended Assessment Metrics
    average_response_time = Column(Float, server_default='0.0')
    total_questions_answered = Column(Integer, server_default='0')
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class QuestionBankItem(Base):
    __tablename__ = "question_bank_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skill = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    response_mode = Column(String, default="mcq")
    level = Column(String, nullable=False)
    difficulty = Column(Float, default=0.5)
    prompt = Column(String, nullable=False)
    stimulus = Column(String)
    options = Column(JSONB)
    answer_key = Column(JSONB)
    rubric = Column(String)

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default=AssessmentStatus.in_progress.value)
    current_index = Column(Integer, default=0)
    total_questions = Column(Integer, default=40)
    evaluation_metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=text('NOW()'))
    updated_at = Column(DateTime(timezone=True), server_default=text('NOW()'), onupdate=text('NOW()'))
    completed_at = Column(DateTime(timezone=True))
    
    responses = relationship("AssessmentResponse", back_populates="assessment", cascade="all, delete-orphan")

class AssessmentResponse(Base):
    __tablename__ = "assessment_responses"
    __table_args__ = (
        sa.UniqueConstraint('assessment_id', 'question_id', name='uq_assessment_question'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("question_bank_items.id", ondelete="SET NULL"))
    
    user_answer = Column(String)
    
    # Normalization fields
    is_correct = Column(Boolean)
    score = Column(Float)
    answer_level = Column(String)
    difficulty = Column(Float, default=0.5)
    
    # Store the full unmodified dynamic LLM response here
    raw_evaluation = Column(JSONB)
    explanation = Column(JSONB) # New: Detailed pedagogical feedback for the UI
    
    # Additional context for simple UI queries
    skill = Column(String)
    category = Column(String)
    response_time_ms = Column(Integer, default=0)
    status = Column(String, default="completed")
    
    created_at = Column(DateTime(timezone=True), server_default=text('NOW()'))
    
    assessment = relationship("Assessment", back_populates="responses")
    question = relationship("QuestionBankItem")

class AssessmentLog(Base):
    __tablename__ = "assessment_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    
    question = Column(String)
    question_text = Column(String)
    user_answer = Column(String)
    correct_answer = Column(String)
    is_correct = Column(Boolean)
    
    skill = Column(String)
    category = Column(String)
    score = Column(Float)
    difficulty = Column(Float)
    
    response_time_ms = Column(Integer)
    duration_ms = Column(Integer)
    
    question_level = Column(String)
    level = Column(String)
    status = Column(String)
    
    evaluation_metadata = Column(JSONB)
    metadata_field = Column("metadata", JSONB) # 'metadata' is often reserved, so we name it metadata_field but map it to 'metadata'
    
    created_at = Column(DateTime(timezone=True), server_default=text('NOW()'))

# Error profiles
class UserErrorProfile(Base):
    __tablename__ = "user_error_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    action_plan = Column(String)
    weakness_areas = Column(JSONB, server_default='[]')
    common_mistakes = Column(JSONB, server_default='[]')
    bridge_delta = Column(String)
    bridge_percentage = Column(Float, default=0.0)
    full_report = Column(JSONB, nullable=False, server_default='{}')
    created_at = Column(DateTime(timezone=True), server_default=text('NOW()'))
    updated_at = Column(DateTime(timezone=True), server_default=text('NOW()'))

class UserErrorAnalysis(Base):
    __tablename__ = "user_error_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("user_error_profiles.id", ondelete="CASCADE"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"))
    question_id = Column(UUID(as_uuid=True), ForeignKey("question_bank_items.id", ondelete="SET NULL"))
    category = Column(String)
    error_rate = Column(Float, default=0.0)
    is_correct = Column(Boolean, default=False)
    ai_interpretation = Column(String)
    user_answer = Column(String)
    correct_answer = Column(String)
    deep_insight = Column(String)
    question_number = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=text('NOW()'))

# Learning Journey
class LearningJourney(Base):
    __tablename__ = "learning_journeys"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), unique=True)
    nodes = Column(JSONB, default=[]) 
    current_node_id = Column(String)
    metadata_json = Column("metadata", JSONB, server_default='{}') 
    created_at = Column(DateTime(timezone=True), server_default=text('NOW()'))
    updated_at = Column(DateTime(timezone=True), server_default=text('NOW()'), onupdate=text('NOW()'))

class JourneyStep(Base):
    __tablename__ = "journey_steps"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journey_id = Column(UUID(as_uuid=True), ForeignKey("learning_journeys.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    description = Column(String)
    order_index = Column(Integer, default=0)
    status = Column(String, default="locked") 
    icon_type = Column(String)
    skill_focus = Column(String)
    is_locked = Column(Boolean, default=True)
    content_payload = Column(JSONB, server_default='{}') 

class UserSkill(Base):
    __tablename__ = "skill_states"
    __table_args__ = (
        sa.UniqueConstraint('user_id', 'skill', name='uq_user_skill'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    skill = Column(String, nullable=False)
    
    # --- DEPRECATED: current_score, current_level ---
    # Use xp_points and current_proficiency_level instead. Kept for backward compatibility.
    current_level = Column(String, default="A1")
    level = Column(String, default="A1")  # Frontend alias for current_level
    current_score = Column(Float, default=0.0)
    
    # --- New Fields for Decoupled System ---
    xp_points = Column(Integer, default=0)
    current_proficiency_level = Column(String, default="A1")
    proficiency_confidence = Column(Float, default=0.0)
    stability_buffer = Column(JSONB, server_default='[]')
    
    confidence = Column(Float, default=0.0)
    category = Column(String)  # e.g., Grammar, Vocabulary
    last_tested = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    badge_name = Column(String, nullable=False)
    earned_at = Column(DateTime(timezone=True), server_default=func.now())
