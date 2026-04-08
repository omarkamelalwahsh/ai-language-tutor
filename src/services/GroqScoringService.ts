import { AssessmentQuestion, AnswerRecord, TaskEvaluation } from '../types/assessment';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY || ""; 
const MODEL_A = "llama-3.1-8b-instant"; 
const MODEL_B = "llama-3.3-70b-versatile";

export interface ModelAOutput {
  is_correct: boolean;
  error_tag: string;
  brief_explanation: string;
}

export interface ModelBOutput {
  final_level: string;
  summary: string;
  bridge_delta: string;
  bridge_percentage: number; // Approximate mastery (0-100)
  missing_skills: string[];
  action_plan: string[]; // Numbered checklist for the student
  error_analysis_report: string;
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
   * Model A: Fast scoring and error tagging
   */
  public static async scoreWithModelA(question: AssessmentQuestion, answer: string): Promise<ModelAOutput | null> {
    const systemPrompt = `You are an expert English linguist. 
IMPORTANT: You must respond ONLY in JSON format.

**Role:** Assistant Language Scorer (Instant Feedback)
**Task:** Diagnostic tagging of the user's answer.
**Input:** {question, user_answer, correct_answer, category}
**Output (JSON):**
{
  "is_correct": boolean,
  "error_tag": "string",
  "brief_explanation": "string"
}`;

    // Extract correct answer from various possible locations in the object
    const correctAns = question.correctAnswer || (question as any)._efset?.answer_key || "Contact Administrator";
    const correctText = typeof correctAns === 'string' ? correctAns : JSON.stringify(correctAns);

    const userMessage = JSON.stringify({
      question: question.prompt,
      user_answer: answer,
      correct_answer: correctText,
      category: question.skill
    });

    return await this.callGroq(MODEL_A, systemPrompt, userMessage);
  }

  /**
   * Model B: Deep history analysis and Bridge Level determination
   */
  public static async analyzeWithModelB(evaluations: TaskEvaluation[]): Promise<ModelBOutput | null> {
    const systemPrompt = `You are an expert English tutor. Respond ONLY in JSON format.
**Role:** Senior CEFR Linguistic Professor
**Task:** Deep analysis of the student's 20-question assessment session.

**Rules for Analysis:**
1. **Bridge Level:** Determine if they are between levels (e.g., B1+).
2. **Bridge Percentage:** Provide approximate mastery of the current level (0-100%).
3. **Style & Fluency:** For open-ended answers, look at vocabulary variety and sentence structure logic.
4. **Action Plan:** A numbered list of 3-5 concrete steps the student should take to reach the next level.

**Output (JSON):**
{
  "final_level": "string (e.g., B1+)",
  "summary": "1-sentence summary of overall performance.",
  "bridge_delta": "Encouraging description of how close they are to the next milestone.",
  "bridge_percentage": number,
  "missing_skills": ["List of core grammar/vocab items to fix"],
  "action_plan": ["Numbered", "Actionable", "Steps"],
  "error_analysis_report": "Deep linguistic pattern analysis."
}`;

    // Prepare context using Model A's previous evaluations
    const historyContext = evaluations.map(ev => ({
      skill: ev.primarySkill || ev.skill,
      level: ev.difficulty,
      prompt: ev.rawSignals?.prompt || "N/A",
      user_answer: ev.rawSignals?.answer || "N/A",
      correct_answer: ev.rawSignals?.answerKey || "N/A",
      is_correct: ev.channels?.comprehension === 1,
      error_tag: ev.errorTag || "None",
      model_a_reason: ev.briefExplanation || "N/A"
    }));

    return await this.callGroq(MODEL_B, systemPrompt, JSON.stringify(historyContext));
  }
}
