import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session
import logging

from app.services.profile_aggregator import aggregator
from app.integrations.groq_client import generate_architect_task
from app.services.vocab_log_service import VocabLogService

logger = logging.getLogger(__name__)

class TaskGenerator:
    """
    TaskFactory Maestro: Responsible for fetching unified context,
    formatting it, and generating highly personalized language tasks.
    """

    @staticmethod
    def _normalize_level(level: Any) -> str:
        level_value = str(level or "").strip().upper()
        return level_value if level_value in {"A1", "A2", "B1", "B2", "C1", "C2"} else "B1"

    @staticmethod
    def _normalize_skill(skill: Any) -> str:
        raw = str(skill or "").strip().upper()
        aliases = {
            "READ": "READING",
            "READING": "READING",
            "LISTEN": "LISTENING",
            "LISTENING": "LISTENING",
            "WRITE": "WRITING",
            "WRITING": "WRITING",
            "SPEAK": "SPEAKING",
            "SPEAKING": "SPEAKING",
            "ORAL": "SPEAKING",
            "PRONUNCIATION": "SPEAKING",
            "FLUENCY": "SPEAKING",
            "GRAMMAR": "WRITING",
            "VOCABULARY": "READING",
        }
        return aliases.get(raw, raw or "SPEAKING")

    @classmethod
    def _build_contextual_fallback(cls, *, task_type: str, skill_type: str, target_level: str, chosen_domain: str, user_level: str) -> Dict[str, Any]:
        """Build a skill/level-aware fallback instead of returning a blind static template."""
        requested_skill = cls._normalize_skill(skill_type or task_type)
        requested_level = cls._normalize_level(target_level or user_level)
        domain = (chosen_domain or "Professional English").strip() or "Professional English"
        if requested_skill in {"SPEAKING", "WRITING", "READING", "LISTENING"}:
            logger.info("[STRICT SKILL ENFORCEMENT] forced skill=%s level=%s domain=%s", requested_skill, requested_level, domain)

        fallback_prompt = "Practice the requested skill with a short, level-appropriate prompt."
        stimulus = "Use the current node context and CEFR level to guide the task."
        target_response = "A clear, concise answer appropriate for the learner's level."

        if requested_skill in {"SPEAKING", "ORAL", "PRONUNCIATION", "FLUENCY"}:
            fallback_prompt = f"Record a short speaking response about a {domain} situation. Use {requested_level} vocabulary and grammar."
            stimulus = f"Describe a recent {domain} experience in 3-4 sentences suitable for a {requested_level} learner."
            target_response = f"A short spoken answer about a {domain} experience, written at CEFR {requested_level}."
            task_type_label = "SPEAKING_PROMPT"
            task_metadata_type = "SPEAKING_PROMPT"
        elif requested_skill in {"READING", "READ"}:
            fallback_prompt = f"Read the short passage and answer one comprehension question about a {domain} scenario at CEFR {requested_level}."
            stimulus = f"A compact reading passage about {domain}, written with {requested_level} complexity and one clear main idea."
            target_response = f"One short answer identifying the main idea of the {domain} passage."
            task_type_label = "READING_COMPREHENSION"
            task_metadata_type = "READING_COMPREHENSION"
        else:
            fallback_prompt = f"Complete a short {requested_skill} activity for a {requested_level} learner in the {domain} domain."
            stimulus = f"A concise {requested_skill} prompt tailored to {domain} and CEFR {requested_level}."
            target_response = "A short answer that fits the requested skill and level."
            task_type_label = (task_type or requested_skill).upper()
            task_metadata_type = (task_type or requested_skill).upper()

        return {
            "task_metadata": {
                "id": str(uuid.uuid4()),
                "type": task_metadata_type,
                "skill": requested_skill,
                "skill_tag": requested_skill,
                "level": requested_level,
                "difficulty_score": 0.45,
                "category": requested_skill,
                "target_level": requested_level,
                "chosen_domain": domain,
                "is_fallback": True,
            },
            "content": {
                "instruction": fallback_prompt,
                "stimulus": stimulus,
                "task_prompt": fallback_prompt,
                "target_response": target_response,
                "explanation": f"Fallback task adapted to requested skill '{requested_skill}' and CEFR level '{requested_level}' because the dynamic generator failed.",
                "task_type_label": task_type_label,
            },
        }

    # Static fallbacks to ensure the UI never breaks
    STATIC_FALLBACKS = {
        "WORD_BUILDER": {
            "task_metadata": {
                "type": "WORD_BUILDER",
                "difficulty_score": 0.3,
                "skill_tag": "Vocabulary"
            },
            "content": {
                "instruction": "Unscramble the letters to form the correct word.",
                "stimulus": "The process of teaching a machine to learn from data.",
                "target": "training",
                "fragments": ["i", "n", "t", "r", "a", "i", "n", "g"],
                "explanation": "Training is the core process of machine learning where models find patterns in data."
            }
        },
        "SCRAMBLED_SENTENCE": {
            "task_metadata": {
                "type": "SCRAMBLED_SENTENCE",
                "difficulty_score": 0.6,
                "skill_tag": "Syntax"
            },
            "content": {
                "instruction": "Reorder the fragments to describe the training process.",
                "stimulus": "The model learns patterns from the training data.",
                "target": "The model learns patterns from the training data",
                "fragments": ["learns", "The", "patterns", "data", "training", "from", "model", "the"],
                "explanation": "In English, the standard word order is Subject + Verb + Object. 'The model' is the subject."
            }
        }
    }

    @classmethod
    async def generate_task(cls, user_id: str, task_type: str, db: Session, skill_type: str = "", target_level: str = "", chosen_domain: str = "") -> Dict[str, Any]:
        """
        Generates a task using the Profile Aggregator and the AI Task Architect.
        """
        logger.info(f"Generating dynamic task of type {task_type} for user {user_id}")
        
        # 1. Gather all profile data
        unified_profile = await aggregator.get_unified_profile(user_id, db)
        
        user_domain = unified_profile.get("user_domain", "General Professional")
        user_level = unified_profile.get("user_level", "A2")
        user_interests = unified_profile.get("interests", "Technology")
        user_goal = unified_profile.get("target_goal", "Professional Fluency")
        last_errors = unified_profile.get("last_errors", [])
        legacy_data = unified_profile.get("legacy_data", [])
        
        # 0. Fetch recent vocabulary to avoid repetition
        recent_vocabulary = await VocabLogService.get_recent_user_vocabulary(db, uuid.UUID(user_id))
        
        # Determine base difficulty
        difficulty_map = {"A1": 0.2, "A2": 0.3, "B1": 0.5, "B2": 0.7, "C1": 0.9, "C2": 1.0}
        base_difficulty = difficulty_map.get(user_level, 0.5)
        
        # 📈 Adaptive Algorithm: Adjust difficulty based on recent performance
        performance_delta = 0
        if legacy_data:
            recent_scores = [d["score"] for d in legacy_data]
            avg_score = sum(recent_scores) / len(recent_scores)
            
            if avg_score > 0.85: # User is crushing it
                performance_delta = 0.1
            elif avg_score < 0.40: # User is struggling
                performance_delta = -0.1
        
        difficulty = max(0.1, min(1.0, base_difficulty + performance_delta))
        
        weakness_areas = []
        focus_skill = "Technical Communication"
        if "current_skills" in unified_profile:
            skills = unified_profile["current_skills"]
            sorted_skills = sorted(skills.items(), key=lambda item: item[1] if isinstance(item[1], (int, float)) else 0)
            weakness_areas = [s[0] for s in sorted_skills[:2]]
            if weakness_areas:
                focus_skill = weakness_areas[0]

        # Evaluate technical background for context injection
        is_tech_bg = any(keyword in str(user_domain).lower() + " " + str(user_interests).lower() 
                         for keyword in ["software", "engineering", "ai", "developer", "tech", "computer"])
                         
        if is_tech_bg:
            user_context = f"Domain: {user_domain}, Interests: {user_interests}, Goal: {user_goal}. Professional Context: Software Engineering/AI. IMPORTANT: Inject relevant professional contexts directly into the task (e.g., code reviews, deployment failures, tech idioms, debugging sessions). No generic placeholders."
        else:
            user_context = f"Domain: {user_domain}, Interests: {user_interests}, Goal: {user_goal}"
        
        # 🧠 CQ Idiom Mandate
        cq_idiom_instruction = "None"
        if any(keyword in task_type.upper() for keyword in ["SPEAKING", "LISTENING", "READING", "ROLEPLAY", "IDIOM", "CULTURAL", "CQ", "NUANCE"]):
            cq_idiom_instruction = (
                "You MUST weave in culturally relevant idioms and expressions appropriate for the learner's "
                f"CEFR level ({user_level}). Ensure the idiomatic expressions fit naturally within the {user_domain} context. "
            )
            if is_tech_bg:
                cq_idiom_instruction += "Explicitly inject scenarios like code reviews, deployment failures, and these specific tech idioms: 'Bite the bullet', 'Piece of cake', 'Hit the wall', 'Spaghetti code', and 'Cutting corners'."

        # 🎯 DEBUG PLAN: Log the exact context being sent to AI
        logger.info(f"🔍 DEBUG: Sending Task Request for User {user_id}")
        logger.info(f"   |-- Level: {user_level}")
        logger.info(f"   |-- Difficulty: {difficulty}")
        logger.info(f"   |-- Context: {user_context}")
        logger.info(f"   |-- Task Type: {task_type}")

        # 2. Call the AI Task Architect with strict skill enforcement.
        enforced_skill = cls._normalize_skill(skill_type or task_type or focus_skill)
        if enforced_skill in {"SPEAKING", "WRITING", "READING", "LISTENING"}:
            logger.info("[STRICT SKILL ENFORCEMENT] validating request before Groq call: skill=%s task_type=%s", enforced_skill, task_type)
        try:
            result, _ = await generate_architect_task(
                user_level=target_level or user_level,
                weakness_areas=weakness_areas,
                last_errors=last_errors,
                user_context=user_context,
                task_type=task_type,
                skill_type=enforced_skill,
                chosen_domain=chosen_domain or user_domain,
                focus_skill=enforced_skill,
                difficulty=difficulty,
                recent_vocabulary=recent_vocabulary,
                cq_idiom_instruction=cq_idiom_instruction
            )
            
            # 3. Log the new target word if this is a vocabulary-focused task
            target_word = result.get("content", {}).get("target_response") or result.get("content", {}).get("target")
            if target_word and isinstance(target_word, str) and len(target_word.split()) <= 2:
                await VocabLogService.log_vocabulary_exposure(
                    db, 
                    uuid.UUID(user_id), 
                    target_word, 
                    {"source": "dynamic_task", "task_type": task_type}
                )
            
            # Add a fresh ID for the UI
            if "task_metadata" in result:
                result["task_metadata"]["id"] = str(uuid.uuid4())
            
            # Simple validation
            if "task_metadata" in result and "content" in result:
                return result
            else:
                logger.warning("Invalid JSON shape returned from Groq. Using fallback.")
                raise ValueError("Missing 'task_metadata' or 'content'")
                
        except Exception as e:
            logger.error(f"💥 DYNAMIC TASK GENERATION FAILED: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Use a context-aware fallback if AI fails or the request params are missing.
            fallback = cls._build_contextual_fallback(
                task_type=task_type,
                skill_type=enforced_skill,
                target_level=target_level or user_level,
                chosen_domain=chosen_domain or user_domain,
                user_level=user_level,
            )
            return fallback

    @classmethod
    def _get_fallback_task(cls, task_type: str) -> Dict[str, Any]:
        """Returns a static fallback task."""
        # Refresh the UUID so it's always unique even if it's a fallback
        fallback = cls.STATIC_FALLBACKS.get(task_type, cls.STATIC_FALLBACKS["WORD_BUILDER"])
        fallback["task_metadata"]["id"] = str(uuid.uuid4())
        return fallback
