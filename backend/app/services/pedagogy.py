import uuid
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text

from app.models.domain import (
    UserProficiency,
    ErrorProfile,
    JourneyProgress,
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
        stmt = select(ErrorProfile).where(ErrorProfile.user_id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()

        if not profile:
            profile = ErrorProfile(user_id=user_id, error_ledger={}, chronic_errors=[])
            db.add(profile)
            await db.flush()

        ledger = dict(profile.error_ledger) if profile.error_ledger else {}
        chronic = list(profile.chronic_errors) if profile.chronic_errors else []

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
            # If they got it right, maybe we decrement the error count? 
            # Or just leave it for the 'Review' logic to handle.
            if rule in ledger and ledger[rule]["count"] > 0:
                ledger[rule]["count"] -= 1 # Simple remediation logic

        profile.error_ledger = ledger
        profile.chronic_errors = chronic
        profile.updated_at = datetime.now(timezone.utc)
        await db.flush()

    # --- Task 2.2: Dynamic Session Generator (5-Slot Batch) ---
    @classmethod
    async def generate_5_slot_batch(cls, user_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Algorithm:
        - Slot 1-2: Based on Error Profile (weaknesses)
        - Slot 3-4: Based on Journey Step (current node)
        - Slot 5: Review (previously mastered or chronic error)
        """
        # 1. Fetch Error Profile for weakness-based tasks
        stmt_error = select(ErrorProfile).where(ErrorProfile.user_id == user_id)
        error_profile = (await db.execute(stmt_error)).scalar_one_or_none()
        chronic_errors = error_profile.chronic_errors if error_profile else []

        # 2. Fetch Journey Progress for node-based tasks
        stmt_journey = select(JourneyProgress).where(
            JourneyProgress.user_id == user_id, 
            JourneyProgress.status == 'in_progress'
        ).order_by(JourneyProgress.completed_at.desc()).limit(1)
        current_node = (await db.execute(stmt_journey)).scalar_one_or_none()
        node_id = current_node.node_id if current_node else "intro_node"

        # 3. Construct the plan
        # Note: This is a simplified version that would ideally call an AI architect
        # or fetch from a pre-generated bank.
        plan = [
            {"slot": "error_targeted", "focus": chronic_errors[0] if chronic_errors else "Grammar"},
            {"slot": "error_targeted", "focus": chronic_errors[1] if len(chronic_errors) > 1 else "Vocabulary"},
            {"slot": "journey_step", "focus": node_id},
            {"slot": "journey_step", "focus": node_id},
            {"slot": "review", "focus": "Mixed Mastery"}
        ]
        
        return plan

    # --- Task 2.3: Points & Streak ---
    @classmethod
    def calculate_points(cls, difficulty: float, accuracy: float) -> int:
        """
        Formula: Points = (Task_Difficulty * 10) * Accuracy
        """
        points = (difficulty * 10) * accuracy
        return int(round(points))

    @classmethod
    async def update_streak(cls, user_id: str, db: AsyncSession):
        """
        Updates the daily streak.
        """
        stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await db.execute(stmt)).scalar_one_or_none()
        if not profile: return

        now = datetime.now(timezone.utc)
        last_active = profile.last_active_at
        
        if last_active:
            if last_active.tzinfo is None:
                last_active = last_active.replace(tzinfo=timezone.utc)
            
            delta = now - last_active
            if delta.days == 1:
                profile.streak += 1
            elif delta.days > 1:
                profile.streak = 1
        else:
            profile.streak = 1
        
        profile.last_active_at = now
        await db.flush()

    # --- Task 3.1: Gateway Logic ---
    @classmethod
    async def check_gateway_unlock(cls, user_id: str, node_id: str, score: float, db: AsyncSession):
        """
        Condition: 60% accuracy to unlock the next node.
        """
        if score >= 0.60:
            # Mark current node as completed
            await db.execute(
                update(JourneyProgress)
                .where(JourneyProgress.user_id == user_id, JourneyProgress.node_id == node_id)
                .values(status='completed', completed_at=datetime.now(timezone.utc), score=score)
            )
            
            # Unlock next node (This assumes a sequential node system)
            # For simplicity, we just log it here. In a real system, we'd lookup the next node ID.
            logger.info(f"🔓 Node {node_id} completed by {user_id}. Unlocking next.")

    # --- Task 3.2: Level-Up Handler ---
    @classmethod
    async def handle_level_up(cls, user_id: str, final_exam_score: float, db: AsyncSession):
        """
        Condition: 80% on Final Exam.
        Atomic Transaction:
        1. Update user_level
        2. Generate new roadmap (reset journey)
        3. Reset error ledger (keep chronic ones)
        """
        if final_exam_score >= 0.80:
            # 1. Update Profile Level
            stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await db.execute(stmt)).scalar_one_or_none()
            
            LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
            current_idx = LEVELS.index(profile.overall_level) if profile.overall_level in LEVELS else 0
            new_level = LEVELS[min(current_idx + 1, len(LEVELS)-1)]
            profile.overall_level = new_level
            
            # 2. Reset Error Ledger but keep Chronic
            stmt_error = select(ErrorProfile).where(ErrorProfile.user_id == user_id)
            error_profile = (await db.execute(stmt_error)).scalar_one_or_none()
            if error_profile:
                error_profile.error_ledger = {} # Reset ledger
                # chronic_errors is preserved
            
            # 3. New Journey (Placeholder logic)
            logger.info(f"🏆 LEVEL UP! User {user_id} promoted to {new_level}.")
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
