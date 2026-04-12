import { supabase } from "./supabaseClient.js";
import OpenAI from "openai";

const CONFIG = {
  model: "llama-3.1-8b-instant",
  temperature: 0.1,
  maxTokens: 1000,
};

let llmClient = null;
if (process.env.GROQ_API_KEY) {
  llmClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

const AGGREGATE_SYSTEM_PROMPT = `
### ROLE
You are an expert CEFR Language Examiner. 
A user has completed an assessment, but their results were lost or not computed. 
You will be provided with a JSON array of their answers to various questions.

### TASK
1. Calculate their OVERALL CEFR LEVEL based on their performance.
2. Identify up to 5 major linguistic errors they made across all tasks. For each error, provide the analysis.
3. Determine confidence scores for each major skill (grammar, vocabulary, coherence, speaking) from 0.0 to 1.0.

### STRICT JSON OUTPUT FORMAT
{
  "overallLevel": "A1 | A2 | B1 | B2 | C1 | C2",
  "skills": {
    "grammar": 0.0-1.0,
    "vocabulary": 0.0-1.0,
    "coherence": 0.0-1.0,
    "speaking": 0.0-1.0
  },
  "errorAnalysis": [
    {
      "category": "grammar/vocabulary/coherence",
      "issue": "Specific linguistic error observed",
      "user_answer": "Quote the user's incorrect text",
      "correct_answer": "The correct way to say it",
      "explanation": "Brief rule explanation"
    }
  ]
}
`.trim();

async function runAIAggregateAnalysis(logs) {
  if (!llmClient) {
    console.warn("[Sync Engine] No LLM Client configured. Falling back to heuristic.");
    return null;
  }

  const promptData = logs.map(l => ({
    question_skill: l.skill,
    user_answer: l.user_answer,
    was_marked_correct: l.is_correct,
    difficulty_level: l.cefr_level || l.answer_level
  }));

  try {
    const response = await llmClient.chat.completions.create({
      model: CONFIG.model,
      messages: [
        { role: "system", content: AGGREGATE_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(promptData) },
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error("[Sync Engine] AI Analysis failed:", err);
    return null;
  }
}

export const repairUserConsistency = async (userId) => {
  try {
    const { data: profile } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) return;

    if (profile.onboarding_complete) {
      console.log(`[Sync Engine] Checking integrity for user: ${userId}`);

      // Check if we need to repair missing overall_level OR missing user_error_analysis
      const needsLevelRepair = !profile.overall_level || profile.overall_level === 'Pending';
      const { count } = await supabase
        .from('user_error_analysis')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      const needsErrorAnalysis = count === 0;

      if (needsLevelRepair || needsErrorAnalysis) {
        console.log(`[Sync Engine] Discovered missing data (Level: ${needsLevelRepair}, Errors: ${needsErrorAnalysis}). Preparing AI...`);
        
        const { data: logs } = await supabase
          .from('assessment_responses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (logs && logs.length > 0) {
          const aiResult = await runAIAggregateAnalysis(logs);

          if (aiResult) {
            console.log(`[Sync Engine] AI computed level: ${aiResult.overallLevel}`);
            
            // 1. Repair Level
            if (needsLevelRepair) {
              await supabase
                .from('learner_profiles')
                .update({ overall_level: aiResult.overallLevel })
                .eq('id', userId);
            }

            // 2. Repair Error Analysis
            if (needsErrorAnalysis && aiResult.errorAnalysis && aiResult.errorAnalysis.length > 0) {
              const errorRows = aiResult.errorAnalysis.map(err => ({
                user_id: userId,
                category: err.category || 'General',
                ai_interpretation: err.issue || 'Unspecified',
                user_answer: err.user_answer || '',
                correct_answer: err.correct_answer || '',
                deep_insight: err.explanation || '',
                is_correct: false
              }));
              await supabase.from('user_error_analysis').insert(errorRows);
              console.log(`[Sync Engine] Inserted ${errorRows.length} error analysis rows.`);

              // 3. Repair Error Profile (Action Plan)
              const weaknessAreas = [...new Set(aiResult.errorAnalysis.map(e => e.category))];
              const actionPlan = aiResult.errorAnalysis.map(e => `Focus on ${e.issue}: ${e.explanation}`);
              
              await supabase.from('user_error_profiles').upsert({
                user_id: userId,
                weakness_areas: weaknessAreas,
                common_mistakes: aiResult.errorAnalysis.map(e => e.issue),
                action_plan: actionPlan,
                bridge_delta: "Regenerated via Consistency Engine",
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id' });
              console.log(`[Sync Engine] Updated user_error_profiles for ${userId}.`);
            }

            // 4. Optional: Boost skill states via RPC if they are completely missing (simulate evaluation bundle)
            const skillsToUpdate = Object.entries(aiResult.skills || {});
            for (const [skillName, confidence] of skillsToUpdate) {
                await supabase.rpc('process_evaluation_bundle', {
                    p_user_id: userId,
                    p_points: 10,
                    p_skill: skillName,
                    p_delta: Number(confidence) * 0.1, // moderate bump
                    p_predicted_level: aiResult.overallLevel
                }).catch(e => console.warn(`[Sync] RPC skipped or failed for ${skillName}:`, e.message));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Sync Engine] Repair failed for user ${userId}`, err);
  }
};
