import uuid
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text

from app.models.domain import (
    UserErrorProfile,
    LearningJourney,
    JourneyStep,
    LearnerProfile,
    QuestionBankItem
)

logger = logging.getLogger(__name__)

class PedagogyService:
    """
    The Pedagogical Engine (Logic Engine) for AI-Language Tutor.
    Handles Error Analysis, Session Generation, Progression, and Gamification.
    """

    # --- Task 2.1: Error Analyzer ---
    @classmethod
    async def analyze_error(cls, user_id: str, skill: str, rule: str, is_correct: bool, db: AsyncSession):
        """
        Classifies errors in real-time and updates the error ledger.
        If a rule is failed twice, it flags it as a 'chronic' error.
        """
        stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()

        if not profile:
            profile = UserErrorProfile(
                user_id=user_id, 
                full_report={}, 
                common_mistakes=[]
            )
            db.add(profile)
            await db.flush()

        ledger = dict(profile.full_report) if profile.full_report else {}
        chronic = list(profile.common_mistakes) if profile.common_mistakes else []

        if not is_correct:
            if rule not in ledger:
                ledger[rule] = {"count": 1, "last_failed": datetime.now(timezone.utc).isoformat()}
            else:
                ledger[rule]["count"] += 1
                ledger[rule]["last_failed"] = datetime.now(timezone.utc).isoformat()
                
                # Flag as chronic if failed 2 or more times
                if ledger[rule]["count"] >= 2 and rule not in chronic:
                    chronic.append(rule)
                    logger.info(f"🚩 CHRONIC ERROR FLAG: User {user_id} failed '{rule}' multiple times.")
        else:
            if rule in ledger and ledger[rule]["count"] > 0:
                ledger[rule]["count"] -= 1 # Simple remediation logic

        profile.full_report = ledger
        profile.common_mistakes = chronic
        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()

    # --- Task 2.2: Dynamic Session Generator (5-Slot Batch) ---
    @classmethod
    async def generate_5_slot_batch(cls, user_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Algorithm:
        - NEURAL REPAIR: If chronic errors exist, force 3+ repair slots.
        - Slot 1-2: Based on Error Profile (weaknesses)
        - Slot 3-4: Based on Journey Step (current node)
        - Slot 5: Review (previously mastered)
        """
        # 1. Fetch Error Profile for weakness-based tasks
        stmt_error = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
        error_profile = (await db.execute(stmt_error)).scalar_one_or_none()
        chronic_errors = error_profile.common_mistakes if error_profile else []

        # 2. Fetch Journey Progress
        stmt_journey = (
            select(JourneyStep)
            .join(LearningJourney, JourneyStep.journey_id == LearningJourney.id)
            .where(LearningJourney.user_id == user_id)
            .where(JourneyStep.status == "active")
            .limit(1)
        )
        current_step = (await db.execute(stmt_journey)).scalar_one_or_none()
        node_id = current_step.title if current_step else "Core Consolidation"

        # 3. NEURAL REPAIR INTERVENTION
        # If user has more than 1 chronic error, redirect to Repair Mode
        if len(chronic_errors) >= 1:
            logger.info(f"🚨 NEURAL REPAIR TRIGGERED for User {user_id}. Focusing on: {chronic_errors}")
            return [
                {"slot": "neural_repair", "focus": chronic_errors[0], "is_repair": True},
                {"slot": "neural_repair", "focus": chronic_errors[0], "is_repair": True},
                {"slot": "neural_repair", "focus": chronic_errors[1] if len(chronic_errors) > 1 else chronic_errors[0], "is_repair": True},
                {"slot": "journey_step", "focus": node_id}, # Keep one roadmap anchor
                {"slot": "review", "focus": "Mixed Mastery"}
            ]

        # 4. Standard Flow
        plan = [
            {"slot": "error_targeted", "focus": chronic_errors[0] if chronic_errors else "Grammar"},
            {"slot": "error_targeted", "focus": "Vocabulary"},
            {"slot": "journey_step", "focus": node_id},
            {"slot": "journey_step", "focus": node_id},
            {"slot": "review", "focus": "Mixed Mastery"}
        ]
        
        return plan

    # --- Task 2.3: XP Reservoir & Progression ---
    @classmethod
    def calculate_xp_reward(cls, difficulty: float, accuracy: float, streak: int = 0) -> int:
        """
        Formula: Points = (Task_Difficulty * 40 + 10) * Accuracy
        Range: 10 to 50 XP per task.
        Bonus: +20% if streak > 1.
        """
        base_xp = (difficulty * 40) + 10
        earned_xp = base_xp * accuracy
        
        # Streak Multiplier (Bonus +20%)
        if streak > 1:
            earned_xp *= 1.2
            
        return int(round(earned_xp))

    @classmethod
    async def sync_xp_progress(cls, user_id: str, xp_gained: int, db: AsyncSession):
        """
        Updates the XP Reservoir and checks for Gateway unlock.
        Handles XP carryover and level-specific goals.
        """
        from app.models.domain import LevelConfig
        
        # 1. Fetch Profile and Level Config
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        if not profile: return

        stmt_config = select(LevelConfig).where(LevelConfig.level_name == profile.current_proficiency_level)
        config = (await db.execute(stmt_config)).scalar_one_or_none()
        if not config: return

        # 2. Update Points
        profile.xp_points += xp_gained
        profile.current_level_xp += xp_gained
        
        # 3. Check for Gateway Eligibility
        if profile.current_level_xp >= config.required_xp:
            if not profile.is_gateway_unlocked:
                profile.is_gateway_unlocked = True
                logger.info(f"🔓 GATEWAY UNLOCKED for User {user_id} in {profile.current_proficiency_level}")

        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()

    @classmethod
    async def update_streak(cls, user_id: str, db: AsyncSession):
        """
        Updates the daily streak.
        """
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        if not profile: return

        today = datetime.now(timezone.utc).date()
        
        if profile.last_interaction_date != today:
            # Check if they missed a day (not consecutive)
            if profile.last_interaction_date:
                days_since_last = (today - profile.last_interaction_date).days
                if days_since_last > 1:
                    profile.current_streak = 0
                    logger.info(f"[PedagogyService] Reset streak to 0 for user {user_id} due to missed day.")

            profile.current_streak = (profile.current_streak or 0) + 1
            if profile.current_streak > (profile.longest_streak or 0):
                profile.longest_streak = profile.current_streak
            profile.last_interaction_date = today
        
        profile.last_active_at = datetime.now(timezone.utc)
        await db.flush()

    # --- Task 3.1: Node Unlocking Logic ---
    @classmethod
    async def check_gateway_unlock(cls, user_id: str, step_id: str, score: float, db: AsyncSession):
        """
        Condition: >60% accuracy to unlock the next node.
        Updates completion_accuracy for pedagogical tracking.
        """
        # Mark current node with its accuracy score
        await db.execute(
            update(JourneyStep)
            .where(JourneyStep.id == step_id)
            .values(completion_accuracy=score)
        )

        if score >= 0.60:
            await db.execute(
                update(JourneyStep)
                .where(JourneyStep.id == step_id)
                .values(status='completed', is_locked=False)
            )
            
            logger.info(f"🔓 Node {step_id} unlocked for {user_id} with score {score}")
            await db.flush()

    # --- Task 3.2: Level-Up Handler ---
    @classmethod
    async def handle_level_up(cls, user_id: str, final_exam_score: float, db: AsyncSession):
        """
        Condition: 70% on Gateway Exam (Configurable via LevelConfig).
        Atomic Transaction:
        1. Update user_level
        2. Handle XP Carryover (Reservoir reset with overflow)
        3. Reset Gateway flag
        4. Reset error ledger
        """
        from app.models.domain import LevelConfig
        
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        if not profile: return

        stmt_config = select(LevelConfig).where(LevelConfig.level_name == profile.current_proficiency_level)
        config = (await db.execute(stmt_config)).scalar_one_or_none()
        
        pass_score = config.min_pass_score if config else 0.7

        if final_exam_score >= pass_score:
            # 1. Update Profile Level
            LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
            current_idx = LEVELS.index(profile.current_proficiency_level) if profile.current_proficiency_level in LEVELS else 0
            new_level = LEVELS[min(current_idx + 1, len(LEVELS)-1)]
            
            # 2. XP Carryover (The "Overflow" Logic)
            required_xp = config.required_xp if config else 1000
            excess_xp = max(0, profile.current_level_xp - required_xp)
            
            profile.current_proficiency_level = new_level
            profile.overall_level = new_level # Sync legacy field
            profile.current_level_xp = excess_xp # Carry over the "fakka"
            profile.is_gateway_unlocked = False # Reset for the new level
            
            # 3. Reset Error Ledger but keep Chronic
            stmt_error = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            error_profile = (await db.execute(stmt_error)).scalar_one_or_none()
            if error_profile:
                error_profile.full_report = {} 
            
            logger.info(f"🏆 LEVEL UP! User {user_id} promoted to {new_level}. Carryover XP: {excess_xp}")
            await db.flush()

    # --- Task 4.1: Smart Hint System ---
    @classmethod
    def get_smart_hint(cls, error_type: str) -> str:
        """
        Returns a context-aware hint.
        """
        hints = {
            "Present Simple": "خد بالك من S المفرد (He/She/It takes an 's').",
            "Past Simple": "تذكر استخدام التصريف الثاني للفعل.",
            "Articles": "استخدم 'a' قبل الحروف الساكنة و 'an' قبل حروف العلة.",
            "Passive Voice": "تأكد من استخدام فعل (to be) مع التصريف الثالث."
        }
        return hints.get(error_type, "ركز في القاعدة المتعلقة بهذا السؤال.")
