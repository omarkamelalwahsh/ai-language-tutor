import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, Integer, ForeignKey, DateTime, Date, Text, Enum, text, func, UniqueConstraint
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
    
    # --- Progression Reservoir ---
    xp_points = Column(Integer, default=0) # Total Lifetime XP
    current_level_xp = Column(Integer, default=0) # XP accumulated in current level
    is_gateway_unlocked = Column(Boolean, default=False)
    
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
    # --- Gamification Fields ---
    current_streak = Column(Integer, server_default='0')
    longest_streak = Column(Integer, server_default='0')
    last_interaction_date = Column(Date, nullable=True) 
    streak_freeze_status = Column(Boolean, default=False)
    
    # --- Notification Fields ---
    fcm_token = Column(String, nullable=True) 
    web_notifications_enabled = Column(Boolean, default=True)
    
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
    
    # --- New Progression Logic ---
    completion_accuracy = Column(Float, default=0.0) # Accuracy achieved on this node
    is_repair_node = Column(Boolean, default=False) # True if this is a Neural Repair task
    
    content_payload = Column(JSONB, server_default='{}') 

class LevelConfig(Base):
    __tablename__ = "levels_config"
    level_name = Column(String, primary_key=True) # A1, A2, etc.
    required_xp = Column(Integer, nullable=False)
    chapter_count = Column(Integer, default=5)
    nodes_per_chapter = Column(Integer, default=4)
    min_pass_score = Column(Float, default=0.7) # Minimum score for Gateway Exam

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

class UserNotificationLog(Base):
    __tablename__ = "user_notifications_log"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(String, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)


# ============================================================================
# Administration / RBAC schema (managed by alembic 38dcafcb01e1)
# role: 0 = Student, 1 = Admin, 2 = SuperAdmin
# ============================================================================
class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(String)
    email = Column(String)
    role = Column(sa.SmallInteger, nullable=False, server_default=text("0"))
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"))
    avatar_url = Column(String)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Team(Base):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    team_name = Column(String, nullable=False, unique=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title = Column(String, nullable=False)
    description = Column(String)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"))
    status = Column(String, nullable=False, server_default=text("'pending'"))
    deadline = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DailyContent(Base):
    __tablename__ = "daily_content"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_level = Column(String, nullable=False)
    field = Column(String, nullable=False)
    content = Column(JSONB, nullable=False) # Stores the daily_bites JSON
    day_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserDailyBiteCompletion(Base):
    __tablename__ = "user_daily_bite_completion"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    bite_type = Column(String, nullable=False) # 'vocabulary', 'grammar', etc.
    completed_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('user_id', 'bite_type', 'completed_date', name='uq_user_bite_date'),
    )

class UserVocabularyLog(Base):
    __tablename__ = "user_vocabulary_log"
    __table_args__ = (
        UniqueConstraint('user_id', 'word', name='uq_user_vocab_word'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    word = Column(String, nullable=False)
    exposed_at = Column(DateTime(timezone=True), server_default=func.now())
    context = Column(JSONB, server_default='{}')

class WeeklyVocabulary(Base):
    __tablename__ = "weekly_vocabulary"
    __table_args__ = (
        UniqueConstraint('day_index', 'week_start_date', name='uq_weekly_vocab_day_week'),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_index = Column(Integer, nullable=False)       # 0=Saturday, 1=Sunday, ..., 6=Friday
    word_c1 = Column(String, nullable=False)           # Advanced target word
    word_a1 = Column(String, nullable=False)           # Basic synonym
    insight = Column(Text, nullable=False)              # Usage context
    audio_url = Column(String, nullable=True)           # Path to audio (future)
    week_start_date = Column(Date, nullable=False)      # The Saturday this cycle belongs to
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChatHistory(Base):
    """Stores tutor conversation messages for context persistence."""
    __tablename__ = "chat_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)        # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
