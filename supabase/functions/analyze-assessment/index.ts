import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROK_API_KEY = Deno.env.get('GROK_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'POST', 
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
    } })
  }

  try {
    const { user_id, user_answers } = await req.json()

    if (!GROK_API_KEY) throw new Error("GROK_API_KEY environment variable is missing.")

    // --- STEP 1: Scorer Model (Grok-1) ---
    console.log(`[Edge Function] Scorer Model for user: ${user_id}`);
    const scorerResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { 
            role: "system", 
            content: "You are an AI Exam Scorer. Evaluate the user answers against expected patterns. Return ONLY JSON array: {question_id, skill_tested, result: 'Correct'|'Incorrect', score: 0-1, user_answer, expected_pattern}." 
          },
          { role: "user", content: JSON.stringify(user_answers) }
        ],
        response_format: { type: "json_object" }
      })
    })
    const scoredJSONRaw = await scorerResponse.json();
    const scoredData = scoredJSONRaw.choices[0].message.content;

    // --- STEP 2: Pedagogical Expert (Grok-2) ---
    console.log(`[Edge Function] Expert Model...`);
    const finalAnalysisResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { 
            role: "system", 
            content: `You are a Senior Language Coach. Generate a final report based on scored data.
            Output JSON sections:
            1. placement_outcome: { final_level, recommended_next_step }
            2. strengths: string[]
            3. growth_areas: string[]
            4. skill_breakdown: { [skill]: { ai_insight, meaning, next_focus } }
            5. question_analysis: [ { id, skill_tested, user_answer, correct_answer, result, ai_interpretation, what_it_tells_us } ]
            Strictly return JSON. English Language.` 
          },
          { role: "user", content: scoredData }
        ],
        response_format: { type: "json_object" }
      })
    })
    const analysisJSONRaw = await finalAnalysisResponse.json();
    const finalReport = JSON.parse(analysisJSONRaw.choices[0].message.content);

    // --- STEP 3: Triple Persistence Logic ---
    console.log(`[Edge Function] Triple Persistent Save...`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 1. Profile Update
    await supabase.from('learner_profiles').update({
       overall_level: finalReport.placement_outcome.final_level,
       has_completed_assessment: true,
       last_active_at: new Date()
    }).eq('id', user_id);

    // 2. Summary & Hub (Error Profiles)
    await supabase.from('user_error_profiles').upsert({
      user_id: user_id,
      action_plan: finalReport.placement_outcome.recommended_next_step,
      weakness_areas: finalReport.growth_areas,
      full_report: finalReport
    });

    // 3. Granular Analysis (Question by Question)
    const analysisRows = finalReport.question_analysis.map((q: any, i: number) => ({
      user_id,
      category: q.skill_tested,
      user_answer: q.user_answer,
      correct_answer: q.correct_answer,
      is_correct: q.result === 'Correct',
      ai_interpretation: q.ai_interpretation,
      deep_insight: q.what_it_tells_us,
      question_number: i + 1
    }));
    await supabase.from('user_error_analysis').insert(analysisRows);

    return new Response(JSON.stringify({ success: true, analysis: finalReport }), {
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error(`[Edge Function Error]: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
    })
  }
})
