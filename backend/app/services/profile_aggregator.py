from typing import List, Dict, Any, Callable
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging
import json

logger = logging.getLogger(__name__)

class ProfileAggregator:
    """
    A schema-agnostic aggregator that collects user data from various sources
    and PERSISTS the result back for performance.
    """
    def __init__(self):
        self._collectors: List[Callable[[str, Session], Dict[str, Any]]] = []

    def register_collector(self, collector: Callable[[str, AsyncSession], Dict[str, Any]]):
        self._collectors.append(collector)

    async def get_unified_profile(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        logger.info(f"🚀 [ProfileAggregator] Starting recovery for user: {user_id}")
        
        unified_data = {}
        sources_found = 0
        
        for collect in self._collectors:
            try:
                data = await collect(user_id, db)
                if data:
                    unified_data.update(data)
                    sources_found += 1
                    logger.info(f"  [+] Collector {collect.__name__}: SUCCESS (Data found)")
                else:
                    logger.info(f"  [-] Collector {collect.__name__}: SKIPPED (No data)")
            except Exception as e:
                logger.error(f"  [!] Collector {collect.__name__}: FAILED ({str(e)})")
                continue
        
        # Calculate Confidence Score based on sources
        confidence_score = (sources_found / len(self._collectors)) * 100 if self._collectors else 0
        unified_data["recovery_meta"] = {
            "sources_synced": sources_found,
            "confidence_score": confidence_score,
            "status": "recovered" if sources_found > 0 else "new"
        }

        # Write-Back Logic: Persist to user_error_profiles for next time
        if sources_found > 0:
            await self._persist_profile(user_id, unified_data, db)

        return unified_data

    async def _persist_profile(self, user_id: str, data: Dict[str, Any], db: AsyncSession):
        """Saves the aggregated data back to the database."""
        try:
            # weakness_areas should be a list of skill names (strings), not a dict or JSON string
            current_skills = data.get("current_skills", {})
            weakness_areas = list(current_skills.keys()) if isinstance(current_skills, dict) else []
            
            action_plan = data.get("error_profile", {}).get("action_plan", "")
            
            await db.execute(
                text("""
                    INSERT INTO user_error_profiles (user_id, weakness_areas, action_plan, updated_at)
                    VALUES (:uid, CAST(:wa AS JSONB), :ap, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id) DO UPDATE SET
                    weakness_areas = EXCLUDED.weakness_areas,
                    action_plan = EXCLUDED.action_plan,
                    updated_at = CURRENT_TIMESTAMP
                """),
                {"uid": user_id, "wa": json.dumps(weakness_areas), "ap": action_plan}
            )
            await db.commit()
            logger.info(f"💾 [ProfileAggregator] Successfully persisted profile for {user_id}")
        except Exception as e:
            await db.rollback()
            logger.error(f"⚠️ [ProfileAggregator] Write-back failed: {str(e)}")

# --- Concrete Collectors ---

async def collect_from_legacy_responses(user_id: str, db: AsyncSession) -> Dict[str, Any]:
    res = await db.execute(
        text("SELECT score, skill FROM assessment_responses WHERE user_id = :uid ORDER BY created_at DESC LIMIT 5"),
        {"uid": user_id}
    )
    result = res.all()
    return {"legacy_data": [{"score": r[0], "skill": r[1]} for r in result]} if result else {}

async def collect_from_skill_states(user_id: str, db: AsyncSession) -> Dict[str, Any]:
    res = await db.execute(
        text("SELECT skill, current_level, current_score FROM skill_states WHERE user_id = :uid"),
        {"uid": user_id}
    )
    result = res.all()
    return {"current_skills": {r[0]: r[2] for r in result}} if result else {}

async def collect_from_learner_profile(user_id: str, db: AsyncSession) -> Dict[str, Any]:
    # We fetch goal_context (domain), learning_topics (interests), and proficiency level
    res = await db.execute(
        text("SELECT goal_context, current_proficiency_level, learning_topics, learning_goal FROM learner_profiles WHERE id = :uid"),
        {"uid": user_id}
    )
    result = res.first()
    if result:
        return {
            "user_domain": result[0] or "General Professional",
            "user_level": result[1] or "A1",
            "interests": result[2] or "Technology",
            "target_goal": result[3] or "Professional Communication"
        }
    return {"user_domain": "General Professional", "user_level": "A1", "interests": "General", "target_goal": "Fluency"}

async def collect_from_recent_errors(user_id: str, db: AsyncSession) -> Dict[str, Any]:
    # Fetch recent mistakes from assessment_responses where is_correct is false
    res = await db.execute(
        text("""
            SELECT category, skill 
            FROM assessment_responses 
            WHERE user_id = :uid AND is_correct = false 
            ORDER BY created_at DESC LIMIT 5
        """),
        {"uid": user_id}
    )
    result = res.all()
    
    if result:
        errors = [f"{r[0] or 'General'} in {r[1] or 'Language'}" for r in result]
        return {"last_errors": errors}
    return {"last_errors": []}

# Global Instance
aggregator = ProfileAggregator()
aggregator.register_collector(collect_from_legacy_responses)
aggregator.register_collector(collect_from_skill_states)
aggregator.register_collector(collect_from_learner_profile)
aggregator.register_collector(collect_from_recent_errors)
