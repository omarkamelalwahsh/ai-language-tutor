import json
from groq import AsyncGroq
from app.core.config import settings
from typing import Dict, Any, Tuple

# We store the Groq models here
MODEL_FAST = "llama-3.1-8b-instant"       # Fast MCQ/Grammar scoring (objective)
MODEL_DEEP = "llama-3.3-70b-versatile"    # Deep Writing/Speaking analysis (open_ended) & Audit
MODEL_TASK = "llama-3.3-70b-versatile"    # Dedicated Task Engine for dynamic generation

# Primary Clients
client = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Dedicated Task Engine Client (Third Model)
task_client = AsyncGroq(api_key=settings.GROQ_TASK_ENGINE_API_KEY or settings.GROQ_API_KEY)

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

STRICT INSTRUCTION (EVIDENCE-FIRST ASSESSMENT):
1. IGNORE USER LEVEL ANCHORS: While the current band is {current_level}, you MUST prioritize the actual evidence in the response. If an A1 user produces B2-level grammar/vocab, you MUST detect B2. Do NOT be biased by the current level.
2. DECOUPLED ASSESSMENT: Evaluate based purely on linguistic complexity, discourse markers, grammatical range, and semantic accuracy.

DUAL SCORING & SUB-METRICS:
- task_completion_score: Did the user address ALL parts of the prompt? (0.0-1.0)
- language_quality_score: Pure CEFR linguistic quality regardless of task coverage. (0.0-1.0)
- overall_score = 0.4 * task_completion_score + 0.6 * language_quality_score
- vocabulary_score: Lexical range, precision, and CEFR-appropriateness of vocabulary. (0.0-1.0)
- grammar_score: Range and accuracy of grammatical structures used. (0.0-1.0)

# FEEDBACK STRATEGY (STRICT)
Follow these pedagogical rules when providing "feedback":
1. PRIORITY FOCUS: Focus on ONE priority issue at a time. Do not overwhelm the user.
2. WRITING (Self-Correction First): Identify or hint at the issue first to invite revision. 
3. SPEAKING (Practicality): Focus on comprehensibility and communicative success.

Current band: {current_level}.

OUTPUT FORMAT (strict JSON):
{{
  "is_correct": boolean (true if overall_score >= 0.5),
  "evaluation_mode": "open_ended",
  "task_completion_score": float (0.0-1.0),
  "language_quality_score": float (0.0-1.0),
  "overall_score": float (0.0-1.0),
  "vocabulary_score": float (0.0-1.0),
  "grammar_score": float (0.0-1.0),
  "detected_level": string (CEFR level),
  "confidence_score": float (0.0-1.0),
  "reasoning": "string (detailed logic)",
  "reasoning_summary": string (1-2 sentence justification),
  "feedback": string (pedagogical note focusing on ONE priority issue),
  "suggested_retry_constraint": "string (instruction for next attempt revision)"
}}
"""


async def _call_groq_json(model: str, system_prompt: str, user_message: str, use_task_client: bool = False) -> Dict[str, Any]:
    active_client = task_client if use_task_client else client
    try:
        completion = await active_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": f"{system_prompt}\n\nEnsure the response is a valid JSON object."},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.7 if use_task_client else 0.1, # More creativity for task engine
            max_tokens=2000,
            timeout=30.0
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
4. ENGLISH REPORT: The "diagnosis_report" MUST be provided in English only.
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


_MASTER_TASK_ENGINE_PROMPT = """# ROLE
You are an elite AI Pedagogical Architect specializing in teaching English to technical professionals in the domain of {user_domain} (e.g., Machine Learning, RAG, Computer Vision). Your objective is to generate hyper-targeted, CEFR-aligned learning tasks based on dynamic inputs.

# INPUT VARIABLES
- CEFR Level: {user_level} (A1, A2, B1, B2, C1, C2)
- Skill Category: {skill_category} (SPEAKING, WRITING, LISTENING)
- Specific Task Type: {task_type} 
- Target Vocabulary / Recent Mistakes: {target_vocabulary}
- Difficulty Score: {difficulty}

# 1. CEFR LEVEL CONSTRAINTS (STRICT)
You MUST adhere to the syntax, grammar, and cognitive load appropriate for the {user_level}:
- A1/A2: Maximum 7 words per sentence. Use Present Simple, Past Simple. SVO structure. Direct and literal context. NO complex jargon unless it is in {target_vocabulary}.
- B1/B2: Compound sentences (10-15 words). Use Present Perfect, Modals, Passive Voice. Professional workplace scenarios (e.g., standup meetings, bug reports).
- C1/C2: Complex, multi-clause sentences (20+ words). Use Inversions, Mixed Conditionals, Phrasal Verbs, and Abstract concepts (e.g., architecture optimization, ethical AI, inference latency).

# 2. VOCABULARY INJECTION RULE
You MUST seamlessly integrate the words provided in {target_vocabulary} into the task stimulus or the required answer. The vocabulary must fit the {user_domain} context naturally.

## READING MODULE (Analysis & Synthesis)
- Goals: Comprehension of complex arguments, technical details, and academic register.
- Task Logic: Must include a multi-paragraph stimulus text (200-400 words for C1/C2). 
- Complexity: $O(n)$ scaling where $n$ is word count and clause depth. Use technical themes for high levels.

## LISTENING MODULE (Auditory Precision)
- Goals: Extract meaning from spoken dialogue/monologue. 
- Execution: "stimulus" MUST be a full script. The frontend will play this via TTS. 
- Task Logic: Auditory comprehension questions based on the script.

## WRITING MODULE (Linguistic Rigor)
- Goals: Professional and academic writing accuracy.
- Execution: Evaluate on [Grammar, Vocabulary, Coherence] dimensions.
- Strategy: Critical analysis or professional correspondence prompts.

## SPEAKING MODULE (Fluency & Clarity)
- Goals: Confident oral production.
- Execution: Use Voice/Text toggle. Evaluate [Content, Fluency, Pronunciation].

# OUTPUT SCHEMA (STRICT JSON ONLY)
Output your response as a parseable JSON object matching this schema. DO NOT include markdown formatting outside the JSON or conversational filler.

{{
  "task_metadata": {{
    "category": "{skill_category}",
    "type": "{task_type}",
    "level": "{user_level}",
    "skill_tag": "{skill_category}"
  }},
  "content": {{
    "instruction": "Clear Arabic instruction for the user (e.g., 'أعد صياغة هذه الرسالة لتكون رسمية')",
    "stimulus": "The core text, audio transcript, or reading material (actual text, NOT repeated instruction)",
    "task_prompt": "Specific instruction for the user's action",
    "target_response": "The ideal response for evaluation",
    "hints": ["Hint 1 (Pedagogical)", "Hint 2 (More direct)"],
    "options": ["Target option", "Distractor 1", "Distractor 2", "Distractor 3"],
    "learning_objective": "e.g., Ask for directions politely",
    "evaluation_focus": "e.g., Task completion + phrase accuracy + clarity",
    "target_length": "e.g., 2-4 spoken turns or 1-2 sentences"
  }}
}}
"""


async def generate_architect_task(
    user_level: str,
    weakness_areas: list,
    last_errors: list,
    user_domain: str,
    task_type: str,
    focus_skill: str = "Technical Communication",
    difficulty: float = 0.5
) -> Tuple[Dict[str, Any], str]:
    """
    Elite Pedagogical Engine: Generates hyper-targeted tasks.
    """
    # Map the task type to its skill category
    listening_types = ['LISTEN', 'AUDIO', 'COMPREHENSION']
    speaking_types = ['SPEAK', 'REPEAT', 'ALOUD', 'ROLEPLAY', 'ORAL', 'PROMPT']
    writing_types = ['WRITE', 'RESPONSE', 'EMAIL', 'SENTENCE', 'PARAGRAPH']
    
    skill_category = "READING" # Default
    if any(t in task_type.upper() for t in listening_types):
        skill_category = "LISTENING"
    elif any(t in task_type.upper() for t in speaking_types):
        skill_category = "SPEAKING"
    elif any(t in task_type.upper() for t in writing_types):
        skill_category = "WRITING"

    target_vocabulary = ", ".join(weakness_areas + last_errors) if (weakness_areas or last_errors) else "technical professional terminology"

    system_prompt = _MASTER_TASK_ENGINE_PROMPT.format(
        user_domain=user_domain,
        user_level=user_level,
        skill_category=skill_category,
        task_type=task_type,
        target_vocabulary=target_vocabulary,
        difficulty=difficulty
    )
    
    user_message = f"Architect a {task_type} ({skill_category}) task for a {user_level} {user_domain} professional. Target vocabulary: {target_vocabulary}. Complexity level: {difficulty}."
    
    result = await _call_groq_json(MODEL_TASK, system_prompt, user_message, use_task_client=True)
    return result, MODEL_TASK

# Alias for backward compatibility
generate_dynamic_task = generate_architect_task


# =============================================================================
# SESSION MASTER PROMPT — Architects the full 5-task Daily Mix in one call
# =============================================================================
_SESSION_MASTER_PROMPT = """# ROLE: Smart Session Architect
You design ONE coherent 5-task practice session for an English learner working in the {user_domain} domain.
You receive the learner's profile and EXACTLY 5 tasks.

# 🎯 LEVEL LOCK PROTOCOL (CRITICAL)
You MUST use the specific CEFR level for each skill as provided in `skill_levels`:
{skill_levels_json}

# 🛠️ SKILL-SPECIFIC TEMPLATES
1. **READING**: Must include a multi-paragraph text (stimulus) and 3-4 comprehension questions. Use academic/technical themes for C1/C2.
2. **LISTENING**: Stimulus MUST be a script for a dialogue or monologue (min 100 words for C-level).
3. **WRITING**: Specific prompt (e.g., "Write a critique of...").
4. **SPEAKING**: Scenario-based prompt.

# GENERATION RULES
- **Complexity**: Adjust sentence complexity based on the specific level for that task.
- **Strict Uniqueness**: No repeats.
- **Domain Embedding**: Use {user_domain} naturally.

# STRICT OUTPUT SCHEMA (JSON ONLY)
{{
  "session_summary": "rationale",
  "tasks": [
    {{
      "task_metadata": {{
        "type": "string",
        "slot_role": "review|journey|maintenance",
        "skill": "writing|reading|listening|speaking",
        "level": "CEFR_LEVEL_FOR_THIS_SKILL",
        "difficulty_score": 0.0
      }},
      "content": {{
        "instruction": "English instruction",
        "stimulus": "Script for listening, Multi-paragraph for reading",
        "task_prompt": "Action for user",
        "target_response": "Expected answer",
        "explanation": "Rule"
      }}
    }}
  ]
}}
"""


async def generate_session_batch(
    user_level: str,
    user_domain: str,
    weak_skills: list,
    strongest_skill: str,
    recent_errors: list,
    journey_title: str,
    journey_skill: str,
    difficulty: float = 0.5,
    plan: list = None,
    skill_levels: dict = None
) -> Tuple[Dict[str, Any], str]:
    """
    Single-call architect with per-skill level locking.
    """
    skill_levels_json = json.dumps(skill_levels or {}, indent=2)
    system_prompt = _SESSION_MASTER_PROMPT.format(
        user_level=user_level,
        user_domain=user_domain,
        weak_skills=json.dumps(weak_skills),
        strongest_skill=strongest_skill or "writing",
        recent_errors=json.dumps(recent_errors),
        journey_title=journey_title or "Foundational consolidation",
        journey_skill=journey_skill or "writing",
        difficulty=difficulty,
        skill_levels_json=skill_levels_json
    )

    user_message = json.dumps({
        "level": user_level,
        "domain": user_domain,
        "weak_skills": weak_skills,
        "strongest_skill": strongest_skill,
        "recent_errors": recent_errors,
        "journey": {"title": journey_title, "skill": journey_skill},
        "difficulty_anchor": difficulty,
        "skill_levels": skill_levels
    })

    result = await _call_groq_json(MODEL_TASK, system_prompt, user_message, use_task_client=True)
    return result, MODEL_TASK


# =============================================================================
# SKILL PRACTICE MASTER PROMPT — Architects 5 progressive tasks on ONE skill
# =============================================================================
_SKILL_PRACTICE_MASTER_PROMPT = """# ROLE: Progressive Skill Architect
You design ONE coherent 5-task progression for a specific language skill ({skill}) within the {user_domain} domain.
The difficulty must climb from -0.1 to +0.2 around the anchor of {difficulty}.

# INPUT CONTEXT
- Targeted Skill: {skill}
- CEFR Level: {user_level}
- Domain / Goal: {user_domain}
- Recent Errors: {recent_errors}
- Active Journey Context: {journey_title}

# PROGRESSION RULES
1. **Task 1 (Entry)**: Difficulty {difficulty}-0.1. A warm-up task to build confidence.
2. **Task 2 (Steady)**: Difficulty {difficulty}-0.05. Slightly more complex sentence structure.
3. **Task 3 (Anchor)**: Difficulty {difficulty}. Exactly at the user's current level.
4. **Task 4 (Stretch)**: Difficulty {difficulty}+0.1. Introduces slightly more complex vocabulary or grammar.
5. **Task 5 (Challenge)**: Difficulty {difficulty}+0.2. Pushes the learner toward the NEXT CEFR level.

# SKILL-SPECIFIC TEMPLATES (STRICT)
## READING: Must include a multi-paragraph stimulus text (200-400 words for C1/C2). Focus on academic/technical analysis.
## LISTENING: Stimulus MUST be a full script (dialogue/monologue).
## WRITING: Evaluate on [Grammar, Vocabulary, Coherence].
## SPEAKING: Use Voice/Text toggle. Evaluate [Content, Fluency, Pronunciation].

# GENERATION RULES
- **Uniqueness**: DO NOT REPEAT STIMULI. Every task must present a new scenario or sentence.
- **Vary Task Types**: Use at least 2-3 different task types.
- **Domain Focus**: All scenarios must be relevant to {user_domain}.

# STRICT OUTPUT SCHEMA (JSON ONLY)
{{
  "session_summary": "Description of the skill ladder built here",
  "tasks": [
    {{
      "task_metadata": {{
        "type": "string",
        "slot_role": "targeted",
        "skill": "{skill}",
        "skill_tag": "{skill}",
        "level": "{user_level}",
        "difficulty_score": 0.0
      }},
      "content": {{
        "instruction": "English instruction",
        "stimulus": "Unique text/scenario. FOR LISTENING TASKS, this MUST be the full audio transcript.",
        "task_prompt": "Specific action",
        "target_response": "Correct answer",
        "explanation": "Brief rule"
      }}
    }}
    // ... exactly 5 tasks total
  ]
}}
"""

async def generate_skill_practice_batch(
    user_level: str,
    user_domain: str,
    skill: str,
    recent_errors: list,
    journey_title: str,
    difficulty: float = 0.5,
) -> Tuple[Dict[str, Any], str]:
    """Generates 5 progressive tasks for one skill in a single coherent call."""
    system_prompt = _SKILL_PRACTICE_MASTER_PROMPT.format(
        user_level=user_level,
        user_domain=user_domain,
        skill=skill,
        recent_errors=json.dumps(recent_errors),
        journey_title=journey_title or "Foundational practice",
        difficulty=difficulty,
    )
    user_message = f"Design a 5-task progression for {skill} for a {user_level} {user_domain} professional. Anchor difficulty: {difficulty}."
    result = await _call_groq_json(MODEL_TASK, system_prompt, user_message, use_task_client=True)
    return result, MODEL_TASK


_DYNAMIC_EVALUATOR_PROMPT = """# ROLE: Socratic AI Tutor & Senior CEFR Examiner
You are an elite pedagogical architect. Your goal is NOT just to correct, but to guide the learner toward self-discovery using the Socratic method. You grade ONE learner response against a single task with academic rigor and empathy.

# SOCRATIC FEEDBACK STRATEGY (STRICT)
1. **Praise First**: Start with a specific, brief highlight of what they did well (e.g., "Excellent use of the passive voice here!").
2. **Guide, Don't Tell**: Instead of giving the direct correction, ask a "Thought-Provoking Question" that hints at the error and encourages the user to find the solution themselves.
3. **Encouraging Tone**: Maintain a supportive, professional, and academic register throughout.

# INPUT DATA
- Task Type: {task_type}
- Skill: {skill}
- Learner's CEFR Level: {user_level}
- Task Difficulty (0.0–1.0): {difficulty}
- Task Stimulus: {stimulus}
- Task Prompt: {prompt}
- Reference Response: {target_response}
- Pedagogical Anchor: {explanation}
- Learner's Response: {user_response}

# EVALUATION MODE
- **CLOSED**: (MCQ, Fill-blank, Scrambled) Score is binary/objective. Use Target Response as ground truth.
- **OPEN**: (Writing, Speaking, Opinions) Judge on CEFR quality, prompt coverage, AND FACTUAL ALIGNMENT. 
- **CRITICAL FACTUAL RULE**: If the response contradicts the `Task Stimulus` (e.g., stating opposites, changing key concepts), you MUST mark `is_correct: false` and reduce the score significantly, regardless of perfect grammar.

# CEFR ANCHORS
- A1–A2: Simple phrases, basic connectors, concrete topics.
- B1: Connected text, opinions with reasons, main points of clear standard input.
- B2: Complex text on concrete/abstract topics, technical discussion, fluency.
- C1: Demanding, longer texts, implicit meaning, flexible and effective language use.
- C2: Effortless, precise, nuanced, near-native.

# OUTPUT SCHEMA (STRICT JSON)
{{
  "score": float,                      // 0.0–1.0
  "is_correct": boolean,
  "evaluation_mode": "closed|open",
  "detected_level": "A1|A2|B1|B2|C1|C2",
  "detailed_feedback": "string (SOCRATIC: Praise + Thought-Provoking Question)",
  "reasoning_summary": "1 sentence justifying the score with evidence",
  "dimensions": {{
    "grammar": float,                  // 0.0–1.0
    "vocabulary": float,               // 0.0–1.0
    "coherence": float,                // 0.0–1.0
    "fluency": float,                  // ONLY for SPEAKING (Voice mode)
    "pronunciation": float             // ONLY for SPEAKING (Voice mode)
  }},
  "error_analysis": {{
    "detected_errors": ["quoted snippets"],
    "corrected_version": "string (The ideal version)",
    "error_category": "Grammar:Tense | Grammar:Agreement | Vocabulary:Word Choice | Pronunciation | Fluency | Other"
  }}
}}
"""


async def evaluate_dynamic_task(
    prompt: str,
    rubric: Dict[str, Any],
    user_response: str,
    task_type: str = "OPEN_RESPONSE",
    skill: str = "general",
    user_level: str = "B1",
    difficulty: float = 0.5,
    stimulus: str = "",
    target_response: str = "",
    explanation: str = "",
) -> Tuple[Dict[str, Any], str]:
    """
    CEFR-aware Evaluator Engine: grades a single learner response.
    Backwards-compatible: callers passing only (prompt, rubric, user_response)
    still work — extra context just sharpens the grading.
    """
    # If a rubric dict was passed, mine it for any missing context fields
    if isinstance(rubric, dict):
        target_response = target_response or rubric.get("target_response") or rubric.get("expected") or ""
        explanation = explanation or rubric.get("explanation") or ""
        stimulus = stimulus or rubric.get("stimulus") or ""

    system_prompt = _DYNAMIC_EVALUATOR_PROMPT.format(
        task_type=task_type,
        skill=skill,
        user_level=user_level,
        difficulty=difficulty,
        stimulus=stimulus or "(none)",
        prompt=prompt,
        target_response=target_response or "(open-ended — no single correct answer)",
        explanation=explanation or "(none)",
        user_response=user_response,
    )

    user_message = json.dumps({
        "task_type": task_type,
        "skill": skill,
        "user_level": user_level,
        "prompt": prompt,
        "target_response": target_response,
        "user_response": user_response,
    })

    result = await _call_groq_json(MODEL_DEEP, system_prompt, user_message)
    return result, MODEL_DEEP
