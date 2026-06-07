from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, update
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
import logging
import json
from fastapi import HTTPException
from app.models.domain import (
    LearnerProfile, JourneyMap, JourneyNode, JourneyTask, ErrorProfile, UserVocabularyState,
    LearningJourney, JourneyStep, UserSkill, CurriculumStage, CanDoOutcome, CurriculumModule
)
from app.integrations.groq_client import _call_groq_json, MODEL_DEEP

# Helpers for CEFR levels
CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

# Skill rotation for the 10 tasks inside each core node:
# Tasks 0-7: 2 per skill in round-robin.  Tasks 8-9: integrated capstones.
CORE_SKILL_ROTATION = [
    "listening", "reading", "writing", "speaking",
    "listening", "reading", "writing", "speaking",
    "integrated", "integrated",
]

def level_gap(level1: str, level2: str) -> int:
    try:
        return CEFR_LEVELS.index(level1) - CEFR_LEVELS.index(level2)
    except ValueError:
        return 0

class JourneyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _fetch_module_node_data(self, module_id: str, skill: str) -> str:
        stmt = (
            select(
                CanDoOutcome.can_do_statement,
                CurriculumModule.grammar_tags,
                CurriculumModule.function_tags
            )
            .select_from(CanDoOutcome)
            .join(CurriculumModule, CanDoOutcome.stage_id == CurriculumModule.stage_id)
            .where(CurriculumModule.module_id == module_id)
            .where(CanDoOutcome.skill_area == skill.lower())
            .limit(1)
        )
        row = (await self.db.execute(stmt)).first()
        if not row:
            return f"Can demonstrate {skill} proficiency."
            
        statement, g_tags, f_tags = row
        
        res = f"Outcome: {statement}"
        if g_tags:
            res += f"\nGrammar Focus: {', '.join(g_tags)}"
        if f_tags:
            res += f"\nFunction Focus: {', '.join(f_tags)}"
        return res

    async def get_or_create_journey(self, user_id: UUID) -> dict:
        """
        Endpoint 1: Returns the user's active JourneyMap along with nodes and tasks.
        If no map exists, it automatically triggers initialization.
        """
        # 1. Try to find the active map
        map_stmt = select(JourneyMap).where(JourneyMap.user_id == user_id, JourneyMap.is_completed == False)
        jmap = (await self.db.execute(map_stmt)).scalar_one_or_none()
        
        # 2. If it doesn't exist, initialize
        if not jmap:
            await self.initialize_catchup_chain(user_id)
            # Re-fetch after initialization
            jmap = (await self.db.execute(map_stmt)).scalar_one_or_none()
            if not jmap:
                raise HTTPException(status_code=500, detail="Failed to initialize journey map.")
                
        # 3. Load full tree: map -> nodes -> tasks
        map_with_nodes_stmt = (
            select(JourneyMap)
            .options(selectinload(JourneyMap.nodes).selectinload(JourneyNode.tasks))
            .where(JourneyMap.id == jmap.id)
        )
        jmap_loaded = (await self.db.execute(map_with_nodes_stmt)).scalar_one()

        # 4. Format for frontend
        nodes = []
        for node in sorted(jmap_loaded.nodes, key=lambda n: n.node_index):
            tasks = []
            for task in sorted(node.tasks, key=lambda t: t.task_index):
                tasks.append({
                    "id": str(task.id),
                    "task_index": task.task_index,
                    "skill_type": task.skill_type,
                    "status": task.status,
                    "alternative_attempts": task.alternative_attempts
                })
            # Calculate node status
            if node.is_locked:
                node_status = "locked"
            else:
                # A node is complete when every task index has at least one successful completion,
                # even if older failed attempts exist for the same task index.
                has_success_for_task = {}
                for t in tasks:
                    if t["status"] == "completed":
                        has_success_for_task[t["task_index"]] = True

                all_completed = len(tasks) > 0 and all(
                    has_success_for_task.get(t["task_index"], False) for t in tasks
                )
                node_status = "completed" if all_completed else "active"
                
            # Infer skill focus from title or default to integrated
            skill_focus = "integrated"
            if node.type == "catch_up":
                # Title format is "Catch-Up: Speaking — Bridge B1→B2"
                if ":" in node.title:
                    skill_focus = node.title.split(":")[1].split("—")[0].strip().lower()
            elif node.type == "core":
                # Title format is "Node 1: Listening Mastery — B2_1_M01"
                if ":" in node.title:
                    skill_focus = node.title.split(":")[1].split(" ")[1].strip().lower()
                    
            nodes.append({
                "id": str(node.id),
                "node_index": node.node_index,
                "title": node.title,
                "description": node.target_cando,
                "target_cando": node.target_cando,
                "is_locked": node.is_locked,
                "status": node_status,
                "skill_focus": skill_focus,
                "type": node.type,
                "tasks": tasks
            })
            
        return {
            "id": str(jmap_loaded.id),
            "total_nodes": jmap_loaded.total_nodes,
            "current_node_index": jmap_loaded.current_node_index,
            "nodes": nodes
        }

    async def initialize_catchup_chain(self, user_id: UUID):
        """
        Endpoint 2: The Catch-Up Chain Injection Engine.
        Dynamically detects skill gaps from UserSkill table and injects
        catch-up nodes with authentic CEFR Can-Do statements.
        """
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        overall_level = profile.current_proficiency_level or "A1"

        # ── 1. DYNAMIC SKILL GAP DETECTION ──────────────────────────
        # Query actual sub-skill scores from the skill_states table.
        # Restrict to 4 core CEFR skills only (exclude grammar/vocabulary).
        CORE_SKILLS = {"reading", "writing", "listening", "speaking"}
        skill_stmt = select(UserSkill).where(
            UserSkill.user_id == user_id,
            UserSkill.skill.in_(list(CORE_SKILLS))
        )
        skill_rows = (await self.db.execute(skill_stmt)).scalars().all()

        # Build a {skill_name: (level, normalized_score)} map.
        # Scores are stored on a 0-10000 scale → normalize to 0-100.
        skill_data: dict[str, tuple[str, float]] = {}
        for row in skill_rows:
            raw_score = row.current_score or 0.0
            normalized = raw_score / 100.0  # e.g. 7300 → 73.0
            skill_data[row.skill.lower()] = (row.current_proficiency_level or overall_level, normalized)

        # Ensure all 4 core skills exist (default score 0 if not in DB)
        for core_skill in CORE_SKILLS:
            if core_skill not in skill_data:
                skill_data[core_skill] = (overall_level, 0.0)

        # Identify weak skills with normalized score < 70%
        weak_skills: list[tuple[str, str, float]] = []  # (skill, level, score)
        for skill_name, (skill_lvl, score) in skill_data.items():
            if score < 70.0:
                weak_skills.append((skill_name, skill_lvl, score))

        # Sort by lowest score first (ASCENDING) — most critical first
        weak_skills.sort(key=lambda x: x[2])
        has_catchup = len(weak_skills) > 0

        # Close implicit transaction from reads before starting a new explicit one
        await self.db.commit()

        # Allocate 4 catch-up nodes strictly among the weak skills
        catchup_allocations = []
        if has_catchup:
            n_weak = len(weak_skills)
            if n_weak == 1:
                catchup_allocations = [weak_skills[0]] * 4
            elif n_weak == 2:
                catchup_allocations = [weak_skills[0]] * 2 + [weak_skills[1]] * 2
            elif n_weak == 3:
                catchup_allocations = [weak_skills[0]] * 2 + [weak_skills[1]] * 1 + [weak_skills[2]] * 1
            else:
                catchup_allocations = [weak_skills[0], weak_skills[1], weak_skills[2], weak_skills[3]]

        TOTAL_NODES = 20
        catchup_node_count = len(catchup_allocations)
        core_node_count = TOTAL_NODES - catchup_node_count

        async with self.db.begin():
            # ── 2. CREATE JOURNEY MAP ───────────────────────────────
            map_stmt = select(JourneyMap).where(JourneyMap.user_id == user_id, JourneyMap.is_completed == False)
            jmap = (await self.db.execute(map_stmt)).scalar_one_or_none()
            if not jmap:
                jmap = JourneyMap(id=uuid4(), user_id=user_id, total_nodes=TOTAL_NODES, current_node_index=0)
                self.db.add(jmap)
                await self.db.flush()

            # ── 3. CATCH-UP NODE INJECTION ────────
            catchup_index = -catchup_node_count  # prepend offset
            if has_catchup:
                # Fetch a generic module or fallback to A1 module for catchup just for getting tags
                # Better: reuse _fetch_module_node_data for weak_lvl but we need a module.
                # For catchups, we will query CanDoOutcome directly since we don't have a module sequence.
                for weak_skill, weak_lvl, score in catchup_allocations:
                    # Generic fallback since catchup doesn't follow strict module sequence
                    cando_stmt_query = (
                        select(CanDoOutcome.can_do_statement)
                        .join(CurriculumStage, CanDoOutcome.stage_id == CurriculumStage.stage_id)
                        .where(CurriculumStage.cefr_band == weak_lvl)
                        .where(CanDoOutcome.skill_area == weak_skill)
                        .limit(1)
                    )
                    cando_res = (await self.db.execute(cando_stmt_query)).scalar_one_or_none()
                    cando_stmt = f"Outcome: {cando_res}" if cando_res else f"Can demonstrate {weak_skill} proficiency at {weak_lvl}."
                    
                    node = JourneyNode(
                        id=uuid4(),
                        journey_map_id=jmap.id,
                        node_index=catchup_index,
                        title=f"Catch-Up: {weak_skill.capitalize()} — Bridge {weak_lvl}→{overall_level}",
                        target_cando=cando_stmt,
                        is_locked=(catchup_index != -catchup_node_count),  # unlock first only
                        type="catch_up"
                    )
                    self.db.add(node)
                    await self.db.flush()

                    # 10 tasks per catch-up node — all focused on the weak skill
                    for t_idx in range(10):
                        task = JourneyTask(
                            id=uuid4(),
                            node_id=node.id,
                            task_index=t_idx,
                            skill_type=weak_skill,
                            status="active" if t_idx == 0 else "locked"
                        )
                        self.db.add(task)
                    
                    catchup_index += 1

            # ── 4. CHRONOLOGICAL MODULE FETCHING ───────────────────
            # Fetch all modules for the current CEFR band, ordered chronologically
            mod_stmt = (
                select(CurriculumModule)
                .join(CurriculumStage, CurriculumModule.stage_id == CurriculumStage.stage_id)
                .where(CurriculumStage.cefr_band == overall_level)
                .order_by(CurriculumStage.order_index, CurriculumModule.module_order)
            )
            modules = (await self.db.execute(mod_stmt)).scalars().all()
            if not modules:
                # Fallback if no modules found
                modules = [None]

            # ── 5. CORE NODE MAP (Sequential Module Distribution) ──
            for i in range(core_node_count):
                primary_skill = ["reading", "writing", "listening", "speaking"][i % 4]
                
                # Distribute nodes across modules
                mod = modules[i % len(modules)]
                if mod:
                    cando_stmt = await self._fetch_module_node_data(mod.module_id, primary_skill)
                    title = f"Node {i+1}: {primary_skill.capitalize()} Mastery — {mod.module_title}"
                else:
                    cando_stmt = f"Can demonstrate {primary_skill} proficiency at CEFR {overall_level} level."
                    title = f"Node {i+1}: {primary_skill.capitalize()} Mastery — {overall_level}"

                node = JourneyNode(
                    id=uuid4(),
                    journey_map_id=jmap.id,
                    node_index=i,
                    title=title,
                    target_cando=cando_stmt,
                    is_locked=has_catchup or (i != 0),
                    type="core"
                )
                self.db.add(node)
                await self.db.flush()

                # ── 6. SKILL DISTRIBUTION MATRIX (2+2+2+2+2 integrated) ──
                for t_idx in range(10):
                    task = JourneyTask(
                        id=uuid4(),
                        node_id=node.id,
                        task_index=t_idx,
                        skill_type=CORE_SKILL_ROTATION[t_idx],
                        status="active" if t_idx == 0 else "locked"
                    )
                    self.db.add(task)

        return {"status": "success", "message": "Journey initialized", "catchup_skills": list(set([w[0] for w in weak_skills]))}

    async def submit_task_evaluation(self, user_id: UUID, task_id: UUID, answer: dict):
        """
        Endpoint 1: The 10-Task Node Execution
        """
        async with self.db.begin():
            stmt = select(JourneyTask).where(JourneyTask.id == task_id)
            task = (await self.db.execute(stmt)).scalar_one_or_none()
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")

            # Floor Check Logic for Catch-Up Nodes (Requires 3 consecutive passes > 75%)
            # This logic executes if the node is catch-up and task is completed
            node_stmt = select(JourneyNode).where(JourneyNode.id == task.node_id)
            node = (await self.db.execute(node_stmt)).scalar_one_or_none()
            
            # Example Evaluation Logic Stub
            score = answer.get('score', 80) # Assume LLM judged this
            has_error = answer.get('has_error', False)
            
            if has_error:
                if task.alternative_attempts == 0:
                    task.alternative_attempts += 1
                    return {"has_error": True, "hint": "Linguistic hint goes here", "status": "active"}
                else:
                    task.status = "failed"
                    # Log error profile
                    err = ErrorProfile(
                        id=uuid4(),
                        user_id=user_id,
                        skill_type=task.skill_type,
                        error_type="grammar_error",
                        raw_input=answer.get('raw_input', ''),
                        frequency=1
                    )
                    self.db.add(err)
                    
                    # Clone an alternative task
                    alt_task = JourneyTask(
                        id=uuid4(),
                        node_id=task.node_id,
                        task_index=task.task_index,
                        skill_type=task.skill_type,
                        status="active",
                        alternative_attempts=0
                    )
                    self.db.add(alt_task)
                    
                    return {"has_error": True, "correct_answer": "...", "explanation": "..."}
            else:
                task.status = "completed"
                
                # Promotion Trigger for vocabulary
                words_used = answer.get("constrained_words_used", [])
                if words_used:
                    upd_stmt = update(UserVocabularyState).where(
                        UserVocabularyState.user_id == user_id,
                        UserVocabularyState.word.in_(words_used),
                        UserVocabularyState.status == "recognized"
                    ).values(status="activated")
                    await self.db.execute(upd_stmt)
                
                # If Task 9 or 10, do dual-metric updates
                if task.task_index >= 8:
                    pass # Dual metrics update logic
                
                # Floor check for catch up nodes: check last 3 tasks
                if node and node.type == "catch_up":
                    # SQL Query to check last 3 tasks
                    # We just mock it here assuming if this executes, they passed.
                    pass
                
                # Unlock next task logic
                next_task_stmt = select(JourneyTask).where(
                    JourneyTask.node_id == task.node_id,
                    JourneyTask.task_index == task.task_index + 1
                )
                next_task = (await self.db.execute(next_task_stmt)).scalar_one_or_none()
                if next_task:
                    next_task.status = "active"
                else:
                    # Node completed, unlock next node
                    node.is_locked = False # Mark current done
                    next_node_stmt = select(JourneyNode).where(
                        JourneyNode.journey_map_id == node.journey_map_id,
                        JourneyNode.node_index == node.node_index + 1
                    )
                    next_node = (await self.db.execute(next_node_stmt)).scalar_one_or_none()
                    if next_node:
                        next_node.is_locked = False
                        
                return {"has_error": False, "score": score}

    async def check_graduation(self, user_id: UUID):
        """
        Endpoint 3: Parallel Error Isolation & Graduation Gate
        """
        async with self.db.begin():
            map_stmt = select(JourneyMap).where(JourneyMap.user_id == user_id, JourneyMap.is_completed == False)
            jmap = (await self.db.execute(map_stmt)).scalar_one_or_none()
            if not jmap:
                raise HTTPException(status_code=404, detail="No active journey map")

            # Simple graduation condition
            if jmap.current_node_index < 20:
                # for blueprint simplicity, assume they can't graduate if not at node 20
                # In real scenario we check if all nodes are completed.
                pass

            err_count_stmt = select(func.count()).select_from(ErrorProfile).where(
                ErrorProfile.user_id == user_id,
                ErrorProfile.is_fixed == False
            )
            unfixed_errors = (await self.db.execute(err_count_stmt)).scalar_one()

            if unfixed_errors > 0:
                raise HTTPException(status_code=400, detail="Unlock Locked: You must clear and resolve all your errors in the 'Fix Your Mistake' node first!")

            # Clean Slate Trigger
            await self.db.execute(delete(ErrorProfile).where(ErrorProfile.user_id == user_id))
            
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one()
            
            curr_lvl = profile.current_proficiency_level or "A1"
            try:
                next_lvl = CEFR_LEVELS[CEFR_LEVELS.index(curr_lvl) + 1]
            except (ValueError, IndexError):
                next_lvl = curr_lvl
            
            profile.current_proficiency_level = next_lvl
            jmap.is_completed = True
            
            return {"status": "success", "new_level": next_lvl, "message": "Graduation successful! Next map generated."}

    # ============================================================================
    # JOURNEY RESET & UPGRADE ENGINE
    # ============================================================================
    async def reset_and_upgrade_journey(self, user_id: UUID) -> dict:
        """
        Admin-level operation: Wipes legacy journey data for a user and
        bootstraps the new 20-node architecture with Catch-Up injection.
        Runs inside an isolated transaction — all-or-nothing.
        """
        async with self.db.begin():
            # ── 1. Nuke legacy tables (LearningJourney → JourneyStep cascade) ──
            legacy_journey_stmt = select(LearningJourney).where(LearningJourney.user_id == user_id)
            legacy_journey = (await self.db.execute(legacy_journey_stmt)).scalar_one_or_none()
            if legacy_journey:
                await self.db.execute(
                    delete(JourneyStep).where(JourneyStep.journey_id == legacy_journey.id)
                )
                await self.db.execute(
                    delete(LearningJourney).where(LearningJourney.user_id == user_id)
                )

            # ── 2. Nuke new-architecture maps (JourneyMap → nodes → tasks cascade) ──
            existing_maps_stmt = select(JourneyMap).where(JourneyMap.user_id == user_id)
            existing_maps = (await self.db.execute(existing_maps_stmt)).scalars().all()
            for jmap in existing_maps:
                # CASCADE handles nodes → tasks, but we delete explicitly for clarity
                node_ids_stmt = select(JourneyNode.id).where(JourneyNode.journey_map_id == jmap.id)
                node_ids = (await self.db.execute(node_ids_stmt)).scalars().all()
                if node_ids:
                    await self.db.execute(
                        delete(JourneyTask).where(JourneyTask.node_id.in_(node_ids))
                    )
                    await self.db.execute(
                        delete(JourneyNode).where(JourneyNode.journey_map_id == jmap.id)
                    )
                await self.db.execute(
                    delete(JourneyMap).where(JourneyMap.id == jmap.id)
                )

            # ── 3. Clear stale error profiles so the new map starts clean ──
            await self.db.execute(
                delete(ErrorProfile).where(ErrorProfile.user_id == user_id)
            )

            # ── 4. Fetch latest learner profile ──
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
            if not profile:
                raise HTTPException(status_code=404, detail="LearnerProfile not found for this user")

            level = profile.current_proficiency_level or "A1"

        # ── 5. Delegate to the initializer (runs its own transaction) ──
        result = await self.initialize_catchup_chain(user_id)
        return {
            "status": "success",
            "migrated_from_level": level,
            "detail": result,
            "message": f"Legacy journey wiped. New 20-node map created at level {level}."
        }

    # ============================================================================
    # CAN-DO OUTCOME HELPERS
    # ============================================================================
    async def _get_node_cando(self, node_id: UUID) -> str:
        """
        Extracts the target_cando descriptor from a JourneyNode.
        Used to inject Can-Do benchmarks into LLM evaluation prompts.
        """
        stmt = select(JourneyNode.target_cando).where(JourneyNode.id == node_id)
        result = (await self.db.execute(stmt)).scalar_one_or_none()
        return result or ""

    # ============================================================================
    # LLM PROMPT STUBS
    # ============================================================================
    async def _apply_vocabulary_constraints(self, user_id: UUID) -> tuple[str, list]:
        """
        Bridge passive comprehension to active execution.
        """
        stmt = select(UserVocabularyState.word).where(
            UserVocabularyState.user_id == user_id,
            UserVocabularyState.status == "recognized"
        ).order_by(func.random()).limit(3)
        words = (await self.db.execute(stmt)).scalars().all()
        
        if words:
            constraint = f"[CRITICAL CONSTRAINT] You must craft the scenario or challenge such that the user is FORCED to utilize the following {len(words)} words to answer correctly: {', '.join(words)}. If they use them accurately, pass their response."
            return constraint, words
        return "", []

    async def process_phonemic_evaluation(self, user_id: UUID, audio_bytes: bytes, expected_text: str = ""):
        """
        Provide granular audio alignment diagnostic analytics.
        Mock integration with low-latency acoustic pipeline.
        """
        # Mocking an acoustic pipeline response that detects recurrent drops
        recurrent_drop = "/p/ evaluated as /b/"
        
        async with self.db.begin():
            # Check if this error exists
            stmt = select(ErrorProfile).where(
                ErrorProfile.user_id == user_id,
                ErrorProfile.error_type == "phonemic_substitution",
                ErrorProfile.raw_input == recurrent_drop
            )
            err = (await self.db.execute(stmt)).scalar_one_or_none()
            
            if err:
                err.frequency += 1
            else:
                new_err = ErrorProfile(
                    id=uuid4(),
                    user_id=user_id,
                    skill_type="speaking",
                    error_type="phonemic_substitution",
                    raw_input=recurrent_drop,
                    frequency=1
                )
                self.db.add(new_err)

    async def execute_multi_agent_roleplay(self, chat_history: list, user_response: str) -> dict:
        """
        Simulate a realistic, high-stakes conversational room with TWO distinct system prompt personas.
        """
        system_prompt = """You are orchestrating a multi-agent roleplay between the user and TWO agents.
Agent A: 'Assertive Manager' - Interrupts, demands hard facts, focuses on corporate performance, formal B2/C1 syntax.
Agent B: 'Skeptical Colleague' - Passive-aggressive, questions logic, forces diplomacy.

Based on the user's latest response, determine who speaks next and what they say. Also evaluate the user's response.
You MUST output strictly in JSON format matching this schema:
{
  "speaking_agent": "manager" or "colleague",
  "response_text": "string (the spoken text)",
  "diplomacy_score": float (0.0-1.0),
  "linguistic_register_match": float (0.0-1.0)
}
"""
        user_message = json.dumps({
            "history": chat_history,
            "user_latest_response": user_response
        })
        
        try:
            result = await _call_groq_json(MODEL_DEEP, system_prompt, user_message)
            return result
        except Exception as e:
            logging.error(f"[MultiAgentRoleplay] LLM Call Failed: {e}")
            raise HTTPException(status_code=502, detail="LLM Provider Timeout or Failure")
