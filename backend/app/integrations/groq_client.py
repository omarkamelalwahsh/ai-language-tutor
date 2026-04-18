import json
from groq import AsyncGroq
from app.core.config import settings
from typing import Dict, Any, Tuple

# We store the Groq models here
MODEL_FAST = "llama-3.1-8b-instant"       # Fast MCQ/Grammar scoring (objective)
MODEL_DEEP = "llama-3.3-70b-versatile"    # Deep Writing/Speaking analysis (open_ended) & Audit

client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# ---------------------------------------------------------------------------
# Evaluation modes
# ---------------------------------------------------------------------------
EVALUATION_MODE_OBJECTIVE = "objective"       # reading, listening, MCQ
EVALUATION_MODE_OPEN_ENDED = "open_ended"     # speaking, writing, monologue


def _select_model(evaluation_mode: str) -> str:
    """Route to 70B for open-ended tasks, 8B for objective tasks."""
    if evaluation_mode == EVALUATION_MODE_OPEN_ENDED:
        return MODEL_DEEP
    return MODEL_FAST


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_OBJECTIVE_SYSTEM_PROMPT = """Act as a Senior CEFR Language Examiner.
You are evaluating an OBJECTIVE task (e.g. MCQ, fill-in-the-blank, reading comprehension).

REFERENCE ANSWER:
- Expected Correct Answer: "{expected_answer}"

SCORING RULES:
1. SEMANTIC TOLERANCE: Focus on MEANING. Accept paraphrases that convey the same answer.
2. MCQ HANDLING: The user must select the correct option.
3. Do NOT penalize minor spelling or capitalisation differences.

DYNAMIC DIFFICULTY RULES:
- Current band: {current_level}.
- STREAK UP: If the user answers 2+ consecutive questions perfectly (score > 0.85), INCREASE difficulty by one sub-level.
- STREAK DOWN: If the user fails 1 question significantly (score < 0.4), DROP difficulty to probe foundational gaps.

OUTPUT FORMAT (strict JSON):
{{
  "is_correct": boolean,
  "evaluation_mode": "objective",
  "task_completion_score": float (0.0-1.0),
  "language_quality_score": float (0.0-1.0),
  "overall_score": float (0.0-1.0),
  "detected_level": string (CEFR level),
  "confidence_score": float (0.0-1.0),
  "reasoning": "string (detailed step-by-step logic for the assigned scores)",
  "reasoning_summary": string (1-2 sentence justification),
  "feedback": string (pedagogical note for the learner)
}}
"""

_OPEN_ENDED_SYSTEM_PROMPT = """Act as a Senior CEFR Language Examiner specialising in productive skills (Speaking & Writing).
You are evaluating an OPEN-ENDED task. There is NO single correct answer.

CRITICAL ANTI-COLLAPSE RULES:
1. Do NOT assign A1/A2 if the response contains multi-clause sentences, abstract reasoning, contrastive structures, or hedging language.
2. Do NOT fail an answer only because it is shorter than ideal. Short but linguistically sophisticated = high CEFR.
3. Do NOT compare against any "expected answer". Judge purely on CEFR quality criteria.
4. Penalise missing task parts SEPARATELY from CEFR language level.

CEFR QUALITY CRITERIA (use these as primary anchor):
- A1-A2: Isolated phrases, basic connectors (and, but), concrete/personal vocabulary.
- B1: Connected text, opinions with reasons, some subordination.
- B2: Clear argumentation, hedging ("it may fail"), abstract vocabulary, discourse markers.
- C1: Nuanced reasoning, contrastive analysis, precise academic register, complex syntax.
- C2: Near-native precision, sophisticated rhetoric, effortless complexity.

STRICT INSTRUCTION (DECOUPLED ASSESSMENT):
Ignore numeric point totals or gamification XP. Evaluate based purely on linguistic complexity, discourse markers, grammatical range, and semantic accuracy.

DUAL SCORING:
- task_completion_score: Did the user address ALL parts of the prompt? (0.0-1.0)
- language_quality_score: Pure CEFR linguistic quality regardless of task coverage. (0.0-1.0)
- overall_score = 0.4 * task_completion_score + 0.6 * language_quality_score

Current band: {current_level}.

OUTPUT FORMAT (strict JSON):
{{
  "is_correct": boolean (true if overall_score >= 0.5),
  "evaluation_mode": "open_ended",
  "task_completion_score": float (0.0-1.0),
  "language_quality_score": float (0.0-1.0),
  "overall_score": float (0.0-1.0),
  "detected_level": string (CEFR level),
  "confidence_score": float (0.0-1.0, required to anchor responses),
  "reasoning": "string (detailed step-by-step logic for the assigned scores and CEFR tier selection)",
  "reasoning_summary": string (1-2 sentence justification referencing specific CEFR evidence),
  "feedback": string (pedagogical note for the learner)
}}
"""


async def _call_groq_json(model: str, system_prompt: str, user_message: str) -> Dict[str, Any]:
    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"{system_prompt}\n\nEnsure the response is a valid JSON object."},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1000,
            timeout=15.0
        )
        content = completion.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        # Fallback empty json if Groq fails
        print(f"[Groq Client Error] {e}")
        return {"error": str(e), "is_correct": False, "overall_score": 0.5, "detected_level": "A1", "is_fallback": True}


async def evaluate_answer(
    prompt: str, 
    expected_answer: str, 
    user_answer: str, 
    current_level: str, 
    evaluation_mode: str = EVALUATION_MODE_OBJECTIVE,
    history: str = "[]"
) -> Tuple[Dict[str, Any], str]:
    """
    Evaluate a single answer using the appropriate model and prompt.
    Returns: (raw_json_dict, model_used)
    """
    model = _select_model(evaluation_mode)

    if evaluation_mode == EVALUATION_MODE_OPEN_ENDED:
        system_prompt = _OPEN_ENDED_SYSTEM_PROMPT.format(current_level=current_level)
    else:
        system_prompt = _OBJECTIVE_SYSTEM_PROMPT.format(
            expected_answer=expected_answer,
            current_level=current_level
        )

    user_message = json.dumps({
        "last_question": prompt,
        "user_answer": user_answer,
        "expected_answer": expected_answer if evaluation_mode == EVALUATION_MODE_OBJECTIVE else None,
        "evaluation_mode": evaluation_mode,
        "session_history": history
    })
    
    result = await _call_groq_json(model, system_prompt, user_message)
    return result, model


async def audit_assessment(history: str) -> Tuple[Dict[str, Any], str]:
    """
    Final diagnostic and consistency audit.
    Returns: (raw_json_dict, model_used)
    """
    system_prompt = """Act as a Senior Psychometrician and Linguistic Auditor. 
You are given a full transcript of an adaptive language assessment.

YOUR TASK:
1. PER-SKILL ANALYSIS: Evaluate all tested skills individually based on the entire session.
2. CONSISTENCY CHECK: Did the user struggle when the level jumped? If yes, anchor their level lower for stability.
3. ADAPTIVE FEEDBACK: Explain WHY they are at this level.
4. BILINGUAL REPORT: The "diagnosis_report" MUST be provided in both Arabic and English.
5. ERROR ANALYSIS: Identify up to 5 major linguistic errors they made across all tasks.

ANTI-COLLAPSE RULES FOR FINAL PLACEMENT:
- If speaking/writing answers consistently show multi-clause sentences, hedging, abstract reasoning: the user is AT LEAST B2.
- Do NOT let poor MCQ performance drag down the entire level if productive skills are strong.
- Weight productive skills (writing/speaking) at 60% and receptive skills (reading/listening) at 40% for final placement.

STRICT INSTRUCTION:
Your "final_cefr_level" determines the user's permanent academic record. Do not flatter the user. Differentiate systematically between minor typos ("slips") from a high-level user, vs systematic errors indicating a lower proficiency.

Ensure your output includes at minimum:
"final_cefr_level", "overall_score", "reasoning", "diagnosis_report", "is_consistent", "skills_breakdown", "error_analysis", "weakness_areas" (array of strings representing high-level focus areas like "Speaking Drills"), "common_mistakes" (array of strings representing specific mistakes), "action_plan" (string detailing the next steps for the user).
"""
    result = await _call_groq_json(MODEL_DEEP, system_prompt, history)
    return result, MODEL_DEEP


async def generate_roadmap(
    current_level: str,
    target_level: str,
    weakness_areas: list,
    common_mistakes: list
) -> Tuple[Dict[str, Any], str]:
    """
    Generates a personalized learning roadmap using the 70B model.
    """
    system_prompt = """Act as a Senior Pedagogy Architect (JourneyArchitect).
Your task is to design a high-precision, 6-node learning roadmap for a language learner.

INPUTS:
- Current CEFR: {current_level}
- Target CEFR: {target_level}
- Weakness Areas: {weakness_areas}
- Common Mistakes: {common_mistakes}

DESIGN RULES:
1. PROGRESSION: The roadmap must bridge the delta between current and target levels.
2. NODE TYPES: Use "lesson" (learning new concepts), "drill" (reinforcement), and "audit" (milestone test).
3. SKILL FOCUS: Distribute nodes across speaking, listening, reading, writing, and grammar.
4. NAMING: Titles must be premium and academic (e.g., "The Subjunctive Threshold" instead of "Grammar Lesson 1").
5. DESCRIPTIONS: Must be pedagogical and supportive.

JSON OUTPUT FORMAT (STRICT):
{{
  "nodes": [
    {{
      "title": "string",
      "description": "string",
      "type": "lesson" | "drill" | "audit",
      "skill_focus": "string",
      "icon_type": "book" | "zap" | "target" | "cpu" | "shield",
      "estimated_minutes": number
    }}
  ],
  "pedagogical_summary": "string (A meta-description of why this path was chosen)"
}}
"""
    user_message = json.dumps({
        "current_level": current_level,
        "target_level": target_level,
        "weakness_areas": weakness_areas,
        "common_mistakes": common_mistakes
    })
    
    result = await _call_groq_json(MODEL_DEEP, system_prompt.format(
        current_level=current_level,
        target_level=target_level,
        weakness_areas=json.dumps(weakness_areas),
        common_mistakes=json.dumps(common_mistakes)
    ), user_message)
    
    return result, MODEL_DEEP
