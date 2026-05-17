import uuid
import asyncio
import logging
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

from app.services.profile_aggregator import aggregator
from app.integrations.groq_client import generate_architect_task, generate_session_batch
from app.models.domain import (
    LearnerProfile,
    UserErrorProfile,
    UserSkill,
    LearningJourney,
    JourneyStep,
    QuestionBankItem,
)
from app.services.pedagogy import PedagogyService

logger = logging.getLogger(__name__)

# CEFR ladder for level math
LEVEL_LADDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
LEVEL_TO_DIFFICULTY = {"A1": 0.2, "A2": 0.3, "B1": 0.5, "B2": 0.7, "C1": 0.85, "C2": 1.0}

# Each skill maps to one canonical task type when picking a "blind" generation
SKILL_TO_TASK_TYPE = {
    "writing": "GUIDED_PARAGRAPH",
    "reading": "VOCABULARY_IN_CONTEXT",
    "listening": "LISTEN_SPECIFIC_DETAIL",
    "speaking": "ANSWER_DIRECT_QUESTION",
    "grammar": "TARGETED_CORRECTION",
    "vocabulary": "WORD_BUILDER",
}

DAILY_MIX_SIZE = 5


class SessionManager:
    """
    The Maestro layer that sits between the UI button press and the AI.
    It reads the learner's full state from the DB, decides WHAT to generate
    (which skills, which difficulty, which weaknesses), then calls the
    Task Architect once per task. After the session, it writes the deltas
    back into learner_profiles / skill_states / journey_steps / user_error_profiles.
    """

    # ------------------------------------------------------------------
    # 1) "Start Practice" — Smart Daily Mix
    # ------------------------------------------------------------------
    @classmethod
    async def build_daily_mix(cls, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Builds a 5-task batch:
            - 2 review tasks targeting the WEAKEST skills (laced with recent errors)
            - 2 journey tasks anchored to the user's current Journey node
            - 1 maintenance task on a STRONG skill at high difficulty
        """
        logger.info(f"[SessionManager] build_daily_mix → user={user_id}")

        unified = await aggregator.get_unified_profile(user_id, db)
        user_level = unified.get("user_level", "A1")
        user_domain = unified.get("user_domain", "General Professional")
        user_interests = unified.get("interests", "Technology")
        user_goal = unified.get("target_goal", "Professional Fluency")
        last_errors = unified.get("last_errors", []) or []
        skills_map = unified.get("current_skills", {}) or {}

        weaknesses, strengths = cls._rank_skills(skills_map)
        journey_focus = await cls._get_active_journey_focus(user_id, db)

        base_difficulty = LEVEL_TO_DIFFICULTY.get(user_level, 0.5)
        performance_delta = cls._performance_delta(unified.get("legacy_data", []))
        adapted_difficulty = max(0.1, min(1.0, base_difficulty + performance_delta))

        # Canonical 5-slot plan — used by both the batch and the per-slot fallback
        journey_skill = journey_focus.get("skill_focus") or (weaknesses[0] if weaknesses else "writing")
        maintenance_skill = strengths[0] if strengths else journey_skill
        plan: List[Tuple[str, str, float]] = [
            ("review",      weaknesses[0] if weaknesses else "writing",       max(0.15, adapted_difficulty - 0.1)),
            ("journey",     journey_skill,                                    adapted_difficulty),
            ("review",      weaknesses[1] if len(weaknesses) > 1 else weaknesses[0] if weaknesses else "writing",
                                                                              max(0.15, adapted_difficulty - 0.05)),
            ("journey",     journey_skill,                                    adapted_difficulty),
            ("maintenance", maintenance_skill,                                min(1.0, adapted_difficulty + 0.15)),
        ]

        # 🎯 LEVEL LOCK PROTOCOL: Fetch individual levels for each skill in the plan
        skill_levels = {}
        for _, s, _ in plan:
            lvl = await cls._get_skill_level(user_id, s, db)
            if not lvl:
                logger.info(f"[SessionManager] Skill '{s}' level missing, using overall anchor: {user_level}")
                lvl = user_level
            else:
                logger.info(f"[SessionManager] Skill '{s}' locked at specialized level: {lvl}")
            skill_levels[s] = lvl

        from app.integrations.groq_client import generate_session_batch

        # ── PRIMARY PATH: single batch call with granular skill levels ──
        domain_str = f"{user_domain} (Interests: {user_interests}, Goal: {user_goal})"
        batch_result, _ = await generate_session_batch(
            user_level=user_level, # Overall anchor
            user_domain=domain_str,
            weak_skills=weaknesses[:3],
            strongest_skill=maintenance_skill,
            recent_errors=last_errors,
            journey_title=journey_focus.get("title"),
            journey_skill=journey_skill,
            difficulty=adapted_difficulty,
            plan=plan,
            skill_levels=skill_levels # 🔑 Strict mapping
        )
        tasks_payload = batch_result.get("tasks", []) if isinstance(batch_result, dict) else []

        # ── FALLBACK PATH: parallel per-slot generation if batch failed ──
        if not tasks_payload:
            logger.warning("[SessionManager] batch architect failed → falling back to per-slot parallel calls")
            tasks_payload = await asyncio.gather(*[
                cls._architect_one(
                    slot_role=role,
                    skill=skill,
                    difficulty=difficulty,
                    user_level=user_level,
                    user_domain=user_domain,
                    user_interests=user_interests,
                    user_goal=user_goal,
                    last_errors=last_errors,
                    journey_title=journey_focus.get("title"),
                )
                for role, skill, difficulty in plan
            ])

        return {
            "session_type": "daily_mix",
            "user_level": user_level,
            "journey_focus": journey_focus,
            "plan": [
                {"slot": role, "skill": skill, "difficulty": difficulty}
                for role, skill, difficulty in plan
            ],
            "tasks": tasks_payload,
        }

    # ------------------------------------------------------------------
    # 2) "Practice Specific Skill" — 5 progressive tasks on one skill
    # ------------------------------------------------------------------
    @classmethod
    async def build_skill_practice(
        cls, user_id: str, skill: str, db: AsyncSession, count: int = DAILY_MIX_SIZE, task_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a 5-task ladder on a single targeted skill.
        Difficulty climbs from -0.1 to +0.2 around the user's current level
        in that specific skill (not the overall level).
        """
        logger.info(f"[SessionManager] build_skill_practice → user={user_id} skill={skill} type={task_type}")

        unified = await aggregator.get_unified_profile(user_id, db)
        user_domain = unified.get("user_domain", "General Professional")
        user_interests = unified.get("interests", "Technology")
        user_goal = unified.get("target_goal", "Professional Fluency")
        last_errors = unified.get("last_errors", []) or []
        overall_level = unified.get("user_level", "A1")

        # Prefer the per-skill level from skill_states if present
        skill_level = await cls._get_skill_level(user_id, skill, db)
        
        if not skill_level:
            logger.info(f"[SessionManager] No specific level for skill='{skill}', falling back to overall='{overall_level}'")
            skill_level = overall_level
        else:
            logger.info(f"[SessionManager] Using specialized level for skill='{skill}': {skill_level}")
        journey_focus = await cls._get_active_journey_focus(user_id, db)

        base = LEVEL_TO_DIFFICULTY.get(skill_level, 0.5)
        
        # 🎯 GROWTH RULE: Skill practice should be slightly harder than current level
        growth_anchor = min(1.0, base + 0.1)
        logger.info(f"[SessionManager] Skill growth anchor: {growth_anchor} (base was {base})")

        # ── SPECIAL PATH: If a specific task_type is requested, try DB first ──
        tasks_payload = []
        if task_type:
            # Normalize frontend IDs to DB types
            db_task_type = task_type
            if task_type == "image_word":
                db_task_type = "visual_vocabulary"

            logger.info(f"[SessionManager] 🎯 Priority DB Fetch for task_type='{db_task_type}' (original='{task_type}')")
            stmt = select(QuestionBankItem).where(
                QuestionBankItem.skill == skill.lower(),
                QuestionBankItem.task_type == db_task_type,
                QuestionBankItem.level == skill_level
            ).limit(count)
            
            result = await db.execute(stmt)
            db_questions = result.scalars().all()
            
            if db_questions:
                for q in db_questions:
                    options = q.answer_key.get("options", []) if isinstance(q.answer_key, dict) else []
                    tasks_payload.append({
                        "task_metadata": {
                            "id": str(q.id),
                            "type": q.task_type,
                            "skill": q.skill,
                            "level": q.level,
                            "difficulty_score": float(q.difficulty or 0.5),
                            "slot_role": "targeted"
                        },
                        "content": {
                            "instruction": q.prompt or "Complete the task",
                            "stimulus": q.stimulus or "",
                            "task_prompt": q.prompt or "",
                            "target_response": q.answer_key.get("correct_option") if isinstance(q.answer_key, dict) else "",
                            "options": options,
                            "explanation": q.answer_key.get("explanation") if isinstance(q.answer_key, dict) else ""
                        }
                    })
                logger.info(f"[SessionManager] Found {len(tasks_payload)} tasks in DB for '{task_type}'")

        # ── PRIMARY PATH: AI Batch generation if not enough tasks from DB ──
        if len(tasks_payload) < count:
            from app.integrations.groq_client import generate_skill_practice_batch
            
            batch_data, _ = await generate_skill_practice_batch(
                user_level=skill_level,
                user_domain=user_domain,
                skill=skill,
                recent_errors=last_errors,
                journey_title=journey_focus.get("title"),
                difficulty=growth_anchor, # 🚀 Applied growth anchor
            )
            
            ai_tasks = batch_data.get("tasks", [])
            
            # 🛡️ Pedagogical Validation: Filter out hallucinations
            validated_ai_tasks = []
            for t in ai_tasks:
                t_type = t.get("task_metadata", {}).get("type", "")
                t_level = t.get("task_metadata", {}).get("level", "")
                
                # Rule 1: No image tasks for B1+ unless we have a real URL (rare for AI)
                if t_type in ["image_word", "visual_vocabulary"] and skill_level not in ["A1", "A2"]:
                    logger.warning(f"[SessionManager] Dropping AI task: image task for high level {skill_level}")
                    continue
                
                # Rule 2: Basic vocabulary (Apple, Banana) check for C1/C2
                target = str(t.get("content", {}).get("target_response", "")).lower()
                if skill_level in ["C1", "C2"] and target in ["apple", "banana", "orange", "car", "dog", "cat"]:
                    logger.warning(f"[SessionManager] Dropping AI task: trivial vocabulary for level {skill_level}")
                    continue
                
                validated_ai_tasks.append(t)

            # Fill up the remaining slots
            for t in validated_ai_tasks:
                if len(tasks_payload) >= count: break
                tasks_payload.append(t)
            
            logger.info(f"[SessionManager] Total tasks after AI batch (validated): {len(tasks_payload)}")

        # ── FALLBACK PATH: per-slot generation if batch failed ──
        if not tasks_payload:
            logger.warning("[SessionManager] skill practice batch failed → falling back")
            deltas = [0.0, 0.05, 0.1, 0.15, 0.2][:count] # Start at anchor and climb
            plan = [(skill, max(0.1, min(1.0, growth_anchor + d))) for d in deltas]
            tasks_payload = await asyncio.gather(*[
                cls._architect_one(
                    slot_role="targeted",
                    skill=skill,
                    difficulty=difficulty,
                    user_level=skill_level,
                    user_domain=user_domain,
                    user_interests=user_interests,
                    user_goal=user_goal,
                    last_errors=last_errors,
                    journey_title=journey_focus.get("title"),
                )
                for skill, difficulty in plan
            ])

        return {
            "session_type": "skill_practice",
            "skill": skill,
            "user_level": skill_level,
            "journey_focus": journey_focus,
            "plan": [
                {"slot": t.get("task_metadata", {}).get("slot_role", "targeted"), 
                 "skill": t.get("task_metadata", {}).get("skill", skill), 
                 "difficulty": t.get("task_metadata", {}).get("difficulty_score", base)}
                for t in tasks_payload
            ],
            "tasks": tasks_payload,
        }

    # ------------------------------------------------------------------
    # 3) Feedback Loop — write session results back into the DB
    # ------------------------------------------------------------------
    @classmethod
    async def process_session_results(
        cls, user_id: str, session_data: Dict[str, Any], db: AsyncSession
    ) -> Dict[str, Any]:
        """
        session_data shape:
        {
            "session_type": "daily_mix" | "skill_practice",
            "results": [
                {"skill": "writing", "score": 0.83, "is_correct": true,
                 "task_metadata": {...}, "error_category": "Passive Voice"|null},
                ...
            ],
            "completed_journey_step_id": "<uuid>" | null
        }

        Returns a summary of what changed so the UI can animate it.
        """
        logger.info(f"[SessionManager] process_session_results → user={user_id}")
        results = session_data.get("results", []) or []
        if not results:
            return {"status": "noop", "reason": "no results submitted"}

        skill_summary = cls._aggregate_per_skill(results)
        new_errors = [r.get("error_category") for r in results if r.get("error_category") and not r.get("is_correct")]

        skill_promotions = await cls._update_skill_states(user_id, skill_summary, db)
        await cls._update_learner_profile(user_id, results, db)
        
        # Identify errors solved in Review tasks to clear them
        solved_errors = [
            r.get("error_category") or r.get("task_metadata", {}).get("skill")
            for r in results 
            if r.get("is_correct") and r.get("task_metadata", {}).get("slot_role") == "review"
        ]
        await cls._merge_recent_errors(user_id, new_errors, db, solved_errors=solved_errors)
        
        # [NEW] Phase 2: Error Analysis & Pedagogy Integration
        for r in results:
            skill = (r.get("skill") or r.get("task_metadata", {}).get("skill") or "general").lower()
            rule = r.get("error_category") or skill
            await PedagogyService.analyze_error(user_id, skill, rule, r.get("is_correct"), db)

        unlocked_step = None
        completed_step_id = session_data.get("completed_journey_step_id")
        if completed_step_id:
            unlocked_step = await cls._advance_journey(user_id, completed_step_id, results, db)

        await db.commit()

        return {
            "status": "ok",
            "tasks_recorded": len(results),
            "skill_summary": skill_summary,
            "skill_promotions": skill_promotions,
            "unlocked_journey_step": unlocked_step,
            "errors_logged": len(new_errors),
        }

    @classmethod
    async def sync_task_result(
        cls, user_id: str, result: Dict[str, Any], db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Processes a single task result immediately to prevent data loss.
        Updates XP, logs, and error profile incrementally.
        Returns a State_Object for real-time UI sync.
        """
        logger.info(f"[SessionManager] sync_task_result → user={user_id} skill={result.get('skill')}")
        
        # 1. Update Profile (XP, Streak, Last Active)
        # Use a transaction block for atomicity
        async with db.begin_nested():
            await cls._update_learner_profile(user_id, [result], db)
            
            # 2. Update Error Profile if needed
            error_cat = result.get("error_category")
            is_correct = result.get("is_correct", False)
            
            new_errors = []
            solved_errors = []
            
            if not is_correct and error_cat:
                new_errors = [error_cat]
            elif is_correct:
                # If correct and was a review slot, mark as potentially solved
                slot_role = result.get("task_metadata", {}).get("slot_role")
                if slot_role == "review":
                    solved_errors = [error_cat or result.get("skill")]
            
            if new_errors or solved_errors:
                await cls._merge_recent_errors(user_id, new_errors, db, solved_errors=solved_errors)
                
            # Real-time Pedagogy Sync
            skill = (result.get("skill") or result.get("task_metadata", {}).get("skill") or "general").lower()
            rule = result.get("error_category") or skill
            await PedagogyService.analyze_error(user_id, skill, rule, result.get("is_correct"), db)
            await PedagogyService.update_streak(user_id, db)

        await db.commit()
        
        # 3. Generate State Object for UI Sync
        unified = await aggregator.get_unified_profile(user_id, db)
        
        # Detect UI trigger (Celebrate if level changed, Unlock if accuracy hit)
        ui_trigger = "Update"
        
        # Check for Level Promotion Celebration
        # (This is a simplified check, ideally we'd track 'previous_level' in the request)
        # For now, let's just return 'Update' and let the frontend compare if needed, 
        # or we could implement a more robust detection here.

        return {
            "status": "synced",
            "state_object": {
                "current_progress": 0, # Should be calculated by frontend based on index
                "updated_skills": unified.get("skills", {}),
                "xp_total": unified.get("xp_points", 0),
                "streak": unified.get("streak", 0),
                "user_level": unified.get("user_level", "A1"),
                "ui_trigger": ui_trigger
            }
        }

    # ==================================================================
    # Helpers
    # ==================================================================
    @staticmethod
    def _rank_skills(skills_map: Dict[str, Any]) -> Tuple[List[str], List[str]]:
        """Returns (weaknesses_low_to_high, strengths_high_to_low)."""
        if not skills_map:
            return ["writing", "speaking"], ["reading"]
        sortable = [(s, v if isinstance(v, (int, float)) else 0.0) for s, v in skills_map.items()]
        weak = [s for s, _ in sorted(sortable, key=lambda kv: kv[1])]
        strong = list(reversed(weak))
        return weak, strong

    @staticmethod
    def _performance_delta(legacy_data: List[Dict[str, Any]]) -> float:
        if not legacy_data:
            return 0.0
        scores = [d.get("score", 0.0) for d in legacy_data if isinstance(d.get("score"), (int, float))]
        if not scores:
            return 0.0
        avg = sum(scores) / len(scores)
        if avg > 0.85:
            return 0.1
        if avg < 0.40:
            return -0.1
        return 0.0

    @staticmethod
    async def _get_active_journey_focus(user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Returns the currently-active Journey step (status='active')."""
        try:
            stmt = (
                select(JourneyStep)
                .join(LearningJourney, JourneyStep.journey_id == LearningJourney.id)
                .where(LearningJourney.user_id == user_id)
                .where(JourneyStep.status == "active")
                .order_by(JourneyStep.order_index.asc())
                .limit(1)
            )
            step = (await db.execute(stmt)).scalar_one_or_none()
            if step:
                return {
                    "step_id": str(step.id),
                    "title": step.title,
                    "skill_focus": (step.skill_focus or "").lower() or None,
                    "order_index": step.order_index,
                }
        except Exception as e:
            logger.warning(f"[SessionManager] active journey lookup failed: {e}")
        return {"step_id": None, "title": None, "skill_focus": None, "order_index": None}

    @staticmethod
    async def _get_skill_level(user_id: str, skill: str, db: AsyncSession) -> Optional[str]:
        try:
            stmt = select(UserSkill).where(UserSkill.user_id == user_id).where(UserSkill.skill == skill)
            row = (await db.execute(stmt)).scalar_one_or_none()
            if row:
                # Legacy users might have current_level="C2" but current_proficiency_level="A1" (default for new column)
                prof_lvl = row.current_proficiency_level
                curr_lvl = row.current_level
                
                # Helper to compare CEFR levels
                levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
                def get_lvl_idx(lvl):
                    return levels.index(lvl) if lvl in levels else -1
                
                prof_idx = get_lvl_idx(prof_lvl)
                curr_idx = get_lvl_idx(curr_lvl)
                
                if curr_idx > prof_idx:
                    return curr_lvl
                return prof_lvl if prof_idx != -1 else curr_lvl
        except Exception as e:
            logger.warning(f"[SessionManager] skill level lookup failed for {skill}: {e}")
        return None

    @classmethod
    async def _architect_batch(
        cls,
        user_level: str,
        user_domain: str,
        weak_skills: List[str],
        strongest_skill: str,
        recent_errors: List[str],
        journey_title: Optional[str],
        journey_skill: str,
        difficulty: float,
        plan: List[Tuple[str, str, float]],
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Single-call path: asks the Master Session Architect for all 5 tasks at once.
        Returns the normalized task list, or None if the AI response is invalid
        (so the caller can fall back to per-slot generation).
        """
        try:
            result, _ = await generate_session_batch(
                user_level=user_level,
                user_domain=user_domain,
                weak_skills=weak_skills,
                strongest_skill=strongest_skill,
                recent_errors=recent_errors,
                journey_title=journey_title or "",
                journey_skill=journey_skill,
                difficulty=difficulty,
            )
        except Exception as e:
            logger.error(f"[SessionManager] batch architect call failed: {e}")
            return None

        raw_tasks = result.get("tasks") if isinstance(result, dict) else None
        if not isinstance(raw_tasks, list) or len(raw_tasks) < DAILY_MIX_SIZE:
            logger.warning(
                f"[SessionManager] batch returned malformed shape "
                f"(type={type(raw_tasks).__name__}, len={len(raw_tasks) if isinstance(raw_tasks, list) else 'n/a'})"
            )
            return None

        normalized: List[Dict[str, Any]] = []
        for i, task in enumerate(raw_tasks[:DAILY_MIX_SIZE]):
            if not isinstance(task, dict) or "task_metadata" not in task or "content" not in task:
                logger.warning(f"[SessionManager] batch task #{i} missing required keys → aborting batch")
                return None

            slot_role, slot_skill, slot_difficulty = plan[i]
            md = task["task_metadata"]
            md["id"] = str(uuid.uuid4())
            md.setdefault("slot_role", slot_role)
            md.setdefault("skill", slot_skill)
            md.setdefault("skill_tag", slot_skill)
            md.setdefault("level", user_level)
            md.setdefault("difficulty_score", slot_difficulty)
            normalized.append(task)

        if "session_summary" in result:
            logger.info(f"[SessionManager] batch summary: {result['session_summary']}")

        return normalized

    @classmethod
    async def _architect_one(
        cls,
        slot_role: str,
        skill: str,
        difficulty: float,
        user_level: str,
        user_domain: str,
        user_interests: str,
        user_goal: str,
        last_errors: List[str],
        journey_title: Optional[str],
    ) -> Dict[str, Any]:
        """Calls the Task Architect for one slot, with a static-fallback safety net."""
        task_type = SKILL_TO_TASK_TYPE.get((skill or "").lower(), "GUIDED_PARAGRAPH")
        domain_str = f"{user_domain} (Interests: {user_interests}, Goal: {user_goal})"
        if journey_title and slot_role == "journey":
            domain_str = f"{domain_str} | Active Journey Node: {journey_title}"

        try:
            result, _ = await generate_architect_task(
                user_level=user_level,
                weakness_areas=[skill],
                last_errors=last_errors,
                user_domain=domain_str,
                task_type=task_type,
                focus_skill=skill,
                difficulty=difficulty,
            )
            if "task_metadata" in result and "content" in result:
                result["task_metadata"]["id"] = str(uuid.uuid4())
                result["task_metadata"]["slot_role"] = slot_role
                result["task_metadata"]["skill"] = skill
                result["task_metadata"]["difficulty_score"] = difficulty
                return result
            logger.warning(f"[SessionManager] AI returned malformed task for slot={slot_role} skill={skill}")
        except Exception as e:
            logger.error(f"[SessionManager] task architect failed (slot={slot_role}): {e}")

        # Safety net so the UI never breaks the 5-card layout
        return {
            "task_metadata": {
                "id": str(uuid.uuid4()),
                "type": task_type,
                "slot_role": slot_role,
                "skill": skill,
                "skill_tag": skill,
                "difficulty_score": difficulty,
                "is_fallback": True,
            },
            "content": {
                "instruction": "Practice this prompt while we reconnect to the AI.",
                "stimulus": "The model learns patterns from the training data.",
                "task_prompt": "Write one sentence describing how this process works.",
                "target_response": "The model finds patterns in the data during training.",
                "explanation": "Fallback task — generated locally because the AI call failed.",
            },
        }

    @staticmethod
    def _aggregate_per_skill(results: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        """Buckets the per-task scores by skill."""
        buckets: Dict[str, Dict[str, float]] = {}
        for r in results:
            skill = (r.get("skill") or r.get("task_metadata", {}).get("skill") or "general").lower()
            score = float(r.get("score", 0.0) or 0.0)
            bucket = buckets.setdefault(skill, {"count": 0, "sum": 0.0, "correct": 0})
            bucket["count"] += 1
            bucket["sum"] += score
            if r.get("is_correct"):
                bucket["correct"] += 1
        # Finalize averages
        for skill, b in buckets.items():
            b["avg_score"] = b["sum"] / b["count"] if b["count"] else 0.0
            b["accuracy"] = b["correct"] / b["count"] if b["count"] else 0.0
        return buckets

    @classmethod
    async def _update_skill_states(
        cls, user_id: str, skill_summary: Dict[str, Dict[str, float]], db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        For each skill touched in the session, push a small XP delta and
        promote the level if accuracy ≥ 0.8 over the bucket.
        Returns a list of {skill, before, after} for the ones that moved.
        """
        promotions: List[Dict[str, Any]] = []
        for skill, stats in skill_summary.items():
            try:
                stmt = select(UserSkill).where(UserSkill.user_id == user_id).where(UserSkill.skill == skill)
                row = (await db.execute(stmt)).scalar_one_or_none()
                accuracy = stats.get("accuracy", 0.0)
                
                # [NEW] Phase 2: Points Calculation Formula
                difficulty = stats.get("avg_score", 0.5) # Using avg_score as proxy for difficulty
                xp_gain = PedagogyService.calculate_points(difficulty, accuracy)

                if not row:
                    new_row = UserSkill(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        skill=skill,
                        current_level="A1",
                        level="A1",
                        current_proficiency_level="A1",
                        xp_points=xp_gain,
                        current_score=stats["avg_score"],
                        confidence=accuracy,
                    )
                    db.add(new_row)
                    continue

                before = row.current_proficiency_level or row.current_level or "A1"
                row.xp_points = (row.xp_points or 0) + xp_gain
                row.current_score = stats["avg_score"]
                row.confidence = accuracy

                if accuracy >= 0.8 and before in LEVEL_LADDER:
                    next_idx = min(LEVEL_LADDER.index(before) + 1, len(LEVEL_LADDER) - 1)
                    after = LEVEL_LADDER[next_idx]
                    if after != before:
                        row.current_proficiency_level = after
                        row.current_level = after
                        row.level = after
                        promotions.append({"skill": skill, "before": before, "after": after})

                # Global Level Promotion Logic: 
                # If average score across skills >= 0.9, we might trigger a global bump.
                # (This is handled in _update_learner_profile for the overall level)
            except Exception as e:
                logger.warning(f"[SessionManager] skill_states update failed for {skill}: {e}")
        return promotions

    @staticmethod
    async def _update_learner_profile(
        user_id: str, results: List[Dict[str, Any]], db: AsyncSession
    ) -> None:
        """Bumps xp_points, accuracy_rate, total_questions_answered, streak, last_active_at."""
        try:
            profile_res = await db.execute(select(LearnerProfile).where(LearnerProfile.id == user_id))
            profile = profile_res.scalar_one_or_none()
            if not profile: return

            scores = [float(r.get("score", 0.0) or 0.0) for r in results]
            correct = sum(1 for r in results if r.get("is_correct"))
            session_acc = correct / len(results) if results else 0.0
            
            # 1. Update Streak & Last Active
            await PedagogyService.update_streak(user_id, db)

            # 2. Calculate & Sync XP Gain (New Structured Logic)
            total_xp_gain = 0
            for r in results:
                # Use difficulty from task if available, else default 0.5
                difficulty = float(r.get("difficulty", 0.5))
                accuracy = 1.0 if r.get("is_correct") else 0.0
                total_xp_gain += PedagogyService.calculate_xp_reward(difficulty, accuracy, profile.current_streak)

            # Sync to Reservoir (This also updates profile object)
            await PedagogyService.sync_xp_progress(user_id, total_xp_gain, db)

            # 3. Update Performance Metrics
            profile.total_questions_answered = (profile.total_questions_answered or 0) + len(results)
            profile.accuracy_rate = (profile.accuracy_rate or 0.0) * 0.7 + session_acc * 0.3

            # 4. Assessment Logs (for weekly tracking)
            estimated_duration_ms = len(results) * 120_000 # 2 min per task
            for r in results:
                skill = (r.get("skill") or "general").lower()
                score = float(r.get("score", 0.0) or 0.0)
                await db.execute(
                    text("""
                        INSERT INTO assessment_logs (id, user_id, skill, score, duration_ms, created_at)
                        VALUES (gen_random_uuid(), :uid, :skill, :score, :dur, CURRENT_TIMESTAMP)
                    """),
                    {"uid": user_id, "skill": skill, "score": score, "dur": estimated_duration_ms // max(len(results), 1)}
                )

            await db.flush()
            logger.info(f"[SessionManager] Profile for {user_id} updated. Gained {total_xp_gain} XP.")

        except Exception as e:
            logger.error(f"[SessionManager] Critical failure in _update_learner_profile: {e}")
            await db.rollback()

    @staticmethod
    async def _merge_recent_errors(
        user_id: str, new_errors: List[str], db: AsyncSession, solved_errors: List[str] = None
    ) -> None:
        """
        Appends the session's error categories into user_error_profiles.common_mistakes.
        If an error was solved in a Review task, it is removed (clear_mistake logic).
        """
        if not new_errors and not solved_errors:
            return
        try:
            res = await db.execute(
                text("SELECT common_mistakes FROM user_error_profiles WHERE user_id = :uid"),
                {"uid": user_id},
            )
            row = res.first()
            existing = row[0] if row and isinstance(row[0], list) else []
            merged = (new_errors + existing)
            seen = set()
            deduped = []
            
            # Filter out solved errors
            solved_set = set(solved_errors or [])
            
            for item in merged:
                if item and item not in seen and item not in solved_set:
                    seen.add(item)
                    deduped.append(item)
            deduped = deduped[:20]

            if row:
                await db.execute(
                    text("""
                        UPDATE user_error_profiles
                        SET common_mistakes = CAST(:cm AS JSONB),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = :uid
                    """),
                    {"cm": _to_jsonb_str(deduped), "uid": user_id},
                )
            else:
                await db.execute(
                    text("""
                        INSERT INTO user_error_profiles (id, user_id, common_mistakes, full_report)
                        VALUES (gen_random_uuid(), :uid, CAST(:cm AS JSONB), CAST('{}' AS JSONB))
                    """),
                    {"cm": _to_jsonb_str(deduped), "uid": user_id},
                )
        except Exception as e:
            logger.warning(f"[SessionManager] merge_recent_errors failed: {e}")

    @staticmethod
    async def _advance_journey(
        user_id: str, completed_step_id: str, results: List[Dict[str, Any]], db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """
        If the session passed (≥60% accuracy), mark the step completed and
        unlock the next ordered step. Returns metadata about the unlocked step.
        """
        try:
            correct = sum(1 for r in results if r.get("is_correct"))
            passed = (correct / len(results)) >= 0.6 if results else False
            if not passed:
                logger.info(f"[SessionManager] journey step NOT advanced (accuracy below threshold)")
                return None

            # [NEW] Phase 3: Gateway Logic Integration
            await PedagogyService.check_gateway_unlock(user_id, completed_step_id, correct/len(results), db)
            
            # [NEW] Phase 3: Level-Up Logic if it's a Final Exam
            is_final = "final" in (step.title or "").lower()
            if is_final:
                await PedagogyService.handle_level_up(user_id, correct/len(results), db)

            stmt = select(JourneyStep).where(JourneyStep.id == completed_step_id)
            step = (await db.execute(stmt)).scalar_one_or_none()
            if not step:
                return None

            step.status = "completed"
            step.is_locked = False

            next_stmt = (
                select(JourneyStep)
                .where(JourneyStep.journey_id == step.journey_id)
                .where(JourneyStep.order_index == step.order_index + 1)
                .limit(1)
            )
            next_step = (await db.execute(next_stmt)).scalar_one_or_none()
            if next_step:
                next_step.status = "active"
                next_step.is_locked = False
                return {
                    "id": str(next_step.id),
                    "title": next_step.title,
                    "skill_focus": next_step.skill_focus,
                    "order_index": next_step.order_index,
                }
        except Exception as e:
            logger.warning(f"[SessionManager] _advance_journey failed: {e}")
        return None


def _to_jsonb_str(value: Any) -> str:
    import json
    return json.dumps(value)
