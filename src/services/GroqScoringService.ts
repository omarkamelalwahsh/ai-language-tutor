import { AssessmentQuestion, AnswerRecord, TaskEvaluation } from '../types/assessment';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY || ""; 
const MODEL_A = "llama-3.1-8b-instant"; 
const MODEL_B = "llama-3.3-70b-versatile";

export interface ProctorOutput {
  score: number; // 0.0 to 1.0 logic
  is_correct: boolean;
  feedback: string;
  error_tag?: string;
  detected_level: string;
  next_question: string;
  expected_skill: "Grammar" | "Speaking" | "Vocabulary";
  current_difficulty_calibration: string;
  reasoning: string;
}

export interface AuditorOutput {
  final_cefr_level: string;
  overall_score: number;
  skills_breakdown: {
    Grammar: { score: number; observation: string };
    Technical_Speaking: { score: number; observation: string };
    Vocabulary: { score: number; observation: string };
  };
  diagnosis_report: string; // Bilingual Arabic/English
  is_consistent: boolean;
}

export class GroqScoringService {
  private static async callGroq(model: string, systemPrompt: string, userMessage: string) {
    try {
      console.log("DEBUG: Sending request with key length:", API_KEY.length);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: `${systemPrompt}\n\nEnsure the response is a valid JSON object.` },
            { role: "user", content: userMessage }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        console.error(`[GroqService] HTTP Error: ${response.status}`);
        return null;
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      
      // Robust Parsing with Regex to handle leading/trailing text
      const cleanJson = content.match(/\{[\s\S]*\}/)?.[0];
      if (!cleanJson) {
        console.error("[GroqService] No JSON found in response:", content);
        return null;
      }

      return JSON.parse(cleanJson);
    } catch (err) {
      console.error("[GroqService] API Call failed:", err);
      return null;
    }
  }

  /**
   * Proctor Agent: Real-time difficulty adjustment and question generation.
   */
  public static async callProctor(
    question: AssessmentQuestion, 
    answer: string, 
    currentLevel: string,
    historyJson: string
  ): Promise<ProctorOutput | null> {
    const systemPrompt = `Act as a Senior CEFR Language Examiner and ML Engineer.
Your goal is to evaluate the user's answer dynamically and deeply, finding their "Breaking Point" or "Proficiency Level."

DYNAMIC DIFFICULTY RULES:
- Start at the user's current level: ${currentLevel}.
- STREAK UP: If the user answers 2 consecutive questions perfectly (Score > 0.85), INCREASE difficulty by one sub-level (e.g., B1 -> B2).
- STREAK DOWN: If the user fails 1 question significantly (Score < 0.4), DROP difficulty immediately to probe for foundational gaps.

CRITICAL SCORING LOGIC (SEMANTIC TOLERANCE):
- Focus on the SEMANTIC MEANING and Linguistic Accuracy. Do NOT enforce a strict 1:1 word match with the "Expected Answer."
- If the "Expected Correct Answer" is empty or null, treat the question as OPEN-ENDED. Score based purely on language quality (Grammar, Lexical Range, Relevance).
- If the user's answer is logically correct or synonymous with the expected answer, SCORE it HIGH (e.g., 1.0) and set is_correct = true. Do NOT penalize for using different words for the same idea.
- score: 0.0 to 1.0 based on accuracy and domain relevance.
- feedback: Short, actionable advice in English.

OUTPUT SCHEMA (Must be strictly JSON):
{
  "score": number,
  "is_correct": boolean,
  "feedback": "string",
  "error_tag": "string",
  "detected_level": "string (A1-C2)",
  "next_question": "string",
  "expected_skill": "Grammar | Speaking | Vocabulary",
  "current_difficulty_calibration": "A1-C2",
  "reasoning": "string"
}`;

    // Gracefully handle undefined/null options and correct answers to prevent LLM hallucinations
    const userMessage = JSON.stringify({
      last_question: question.prompt || "Unknown Question",
      user_answer: answer || "[No Answer]",
      expected_answer: question.correctAnswer || "OPEN ENDED - JUDGE LINGUISTIC QUALITY",
      session_history: historyJson
    });

    return await this.callGroq(MODEL_A, systemPrompt, userMessage);
  }

  /**
   * Auditor Agent: Final diagnostic and consistency audit.
   */
  public static async callAuditor(evaluations: TaskEvaluation[]): Promise<AuditorOutput | null> {
    const systemPrompt = `Act as a Senior Psychometrician and Linguistic Auditor. 
You are given a full transcript of an adaptive language assessment.

YOUR TASK:
1. PER-SKILL ANALYSIS: Evaluate Grammar, Technical Speaking, and Vocabulary individually based on the entire session.
2. CONSISTENCY CHECK: Did the user struggle when the level jumped? If yes, anchor their level lower for stability.
3. ADAPTIVE FEEDBACK: Explain WHY they are at this level.
4. BILINGUAL REPORT: The "diagnosis_report" MUST be provided in both Arabic and English (Professional register).

FINAL EVALUATION SCHEMA:
{
  "final_cefr_level": "string",
  "overall_score": 0.0-1.0,
  "skills_breakdown": {
    "Grammar": {"score": number, "observation": "string"},
    "Technical_Speaking": {"score": number, "observation": "string"},
    "Vocabulary": {"score": number, "observation": "string"}
  },
  "diagnosis_report": "Deep dive analysis in Arabic followed by English.",
  "is_consistent": boolean
}`;

    const historyContext = evaluations.map(ev => ({
      skill: ev.primarySkill,
      level: ev.difficulty,
      prompt: ev.rawSignals?.prompt,
      answer: ev.rawSignals?.answer,
      score: ev.channels?.comprehension,
      error_tag: ev.errorTag
    }));

    return await this.callGroq(MODEL_B, systemPrompt, JSON.stringify(historyContext));
  }
}
