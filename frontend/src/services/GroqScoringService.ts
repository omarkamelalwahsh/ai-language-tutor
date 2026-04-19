import { AssessmentQuestion, AnswerRecord, TaskEvaluation } from '../types/assessment';
import { supabase } from '../lib/supabaseClient';

const MODEL_A = "llama3-8b-8192";       // Fast MCQ/Grammar scoring
const MODEL_B = "llama3-70b-8192";      // Deep Writing/Speaking analysis

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
      console.log(`[GroqService] Forwarding inference request to Backend Proxy (${model})...`);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          modelType: model,
          messages: [
            { role: "system", content: `${systemPrompt}\n\nEnsure the response is a valid JSON object.` },
            { role: "user", content: userMessage }
          ]
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
    const expectedAnswer = (question as any).correctAnswer || "OPEN ENDED - JUDGE LINGUISTIC QUALITY";
    const systemPrompt = `Act as a Senior CEFR Language Examiner.
Your goal is to evaluate the user's answer dynamically and deeply.

DYNAMIC DIFFICULTY RULES:
- Start at the user's current level: ${currentLevel}.
- STREAK UP: If the user answers 2 consecutive questions perfectly (Score > 0.85), INCREASE difficulty by one sub-level (e.g., B1 -> B2).
- STREAK DOWN: If the user fails 1 question significantly (Score < 0.4), DROP difficulty immediately to probe for foundational gaps.

REFERENCE ANSWER:
- Expected Correct Answer: "${expectedAnswer}"

CRITICAL SCORING LOGIC:
1. SEMANTIC TOLERANCE: Focus on MEANING and Linguistic Accuracy. Do NOT enforce a strict 1:1 word match unless it's a specific vocabulary/grammar point.
2. REFERENCE PRIORITY: Use the "Expected Correct Answer" as your primary anchor. If it matches semantically, is_correct MUST be true.
3. OPEN-ENDED HANDLING: If the expected answer is marked "OPEN ENDED", judge purely on Grammar, Lexical Range, and Relevance to the prompt.
4. MCQ HANDLING: If this is an MCQ task, the user must provide the correct option text.

OUTPUT SCHEMA (JSON):
{
  "score": 0.0-1.0,
  "is_correct": boolean,
  "feedback": "string",
  "error_tag": "string",
  "detected_level": "A1-C2",
  "next_question": "string",
  "expected_skill": "Grammar | Speaking | Vocabulary",
  "current_difficulty_calibration": "A1-C2",
  "reasoning": "string"
}`;

    // 🕵️ Developer Logging: Payload Audit
    if (import.meta.env.DEV) {
      console.log("🔍 [Proctor Payload]", {
        prompt: question.prompt,
        user_answer: answer,
        expected_answer: expectedAnswer,
        level: currentLevel
      });
    }

    const userMessage = JSON.stringify({
      last_question: question.prompt || "Unknown Question",
      user_answer: answer || "[No Answer]",
      expected_answer: expectedAnswer,
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

  /**
   * Direct evaluation via the evaluate.js API
   */
  public static async getScoringResultFromAPI(
    question: AssessmentQuestion,
    answer: string,
    currentLevel: string,
    assessmentId: string,
    isLastQuestion: boolean = false
  ): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const userId = session?.user?.id || localStorage.getItem('auth_user_id');

      // 🛡️ assessmentId is now explicitly passed — no more 'pending-sync' fallback
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(`/api/assessments/${assessmentId}/submit-answer`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          assessment_id: assessmentId,
          skill: question.skill,
          current_band: currentLevel,
          user_answer: answer,
          question_id: question.id,
          prompt: question.prompt,
          stimulus: question.stimulus,
          is_mcq: question.response_mode === 'mcq',
          question_number: (question as any).question_number,
          is_last_question: isLastQuestion
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error("API Score fetch failed");
      const data = await response.json();
      
      // Map Python EvaluationResponse to expected Frontend format
      return {
        score: data.normalized_fields?.score || 0.5,
        is_correct: data.normalized_fields?.is_correct || false,
        predicted_level: data.normalized_fields?.predicted_level || currentLevel,
        feedback: data.result?.feedback || "",
        ...data.result
      };
    } catch (err) {
      console.error("[GroqScoringService] API Eval Error:", err);
      return { score: 0.5, is_correct: false, feedback: "Service temporarily unavailable." };
    }
  }
}

