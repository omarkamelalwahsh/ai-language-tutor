import json
from groq import AsyncGroq
from app.core.config import settings
from typing import Dict, Any, Tuple

# We store the Groq models here
MODEL_A = "llama3-8b-8192"       # Fast MCQ/Grammar scoring
MODEL_B = "llama3-70b-8192"      # Deep Writing/Speaking analysis & Audit

client = AsyncGroq(api_key=settings.GROQ_API_KEY)

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
            max_tokens=1000
        )
        content = completion.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        # Fallback empty json if Groq fails
        print(f"[Groq Client Error] {e}")
        return {"error": str(e), "is_correct": False, "score": 0.5, "detected_level": "A1"}

async def evaluate_answer(
    prompt: str, 
    expected_answer: str, 
    user_answer: str, 
    current_level: str, 
    history: str = "[]"
) -> Tuple[Dict[str, Any], str]:
    """
    Evaluate a single answer using Proctor rules.
    Returns: (raw_json_dict, model_used)
    """
    system_prompt = f"""Act as a Senior CEFR Language Examiner.
Your goal is to evaluate the user's answer dynamically and deeply.

DYNAMIC DIFFICULTY RULES:
- Start at the user's current level: {current_level}.
- STREAK UP: If the user answers 2 consecutive questions perfectly (Score > 0.85), INCREASE difficulty by one sub-level (e.g., B1 -> B2).
- STREAK DOWN: If the user fails 1 question significantly (Score < 0.4), DROP difficulty immediately to probe for foundational gaps.

REFERENCE ANSWER:
- Expected Correct Answer: "{expected_answer}"

CRITICAL SCORING LOGIC:
1. SEMANTIC TOLERANCE: Focus on MEANING and Linguistic Accuracy. Do NOT enforce a strict 1:1 word match unless it's a specific vocabulary/grammar point.
2. REFERENCE PRIORITY: Use the "Expected Correct Answer" as your primary anchor. If it matches semantically, is_correct MUST be true.
3. OPEN-ENDED HANDLING: If the expected answer is marked "OPEN ENDED", judge purely on Grammar, Lexical Range, and Relevance.
4. MCQ HANDLING: If this is an MCQ task, the user must provide the correct option text.

Ensure your output includes at minimum these keys allowing for dynamic extensions:
"score" (float 0.0-1.0), "is_correct" (boolean), "detected_level" (string)
"""
    user_message = json.dumps({
        "last_question": prompt,
        "user_answer": user_answer,
        "expected_answer": expected_answer,
        "session_history": history
    })
    
    result = await _call_groq_json(MODEL_A, system_prompt, user_message)
    return result, MODEL_A

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

Ensure your output includes at minimum:
"final_cefr_level", "overall_score", "diagnosis_report", "is_consistent", "skills_breakdown", "error_analysis" (array of objects with category, issue, user_answer, correct_answer, explanation)
"""
    result = await _call_groq_json(MODEL_B, system_prompt, history)
    return result, MODEL_B
