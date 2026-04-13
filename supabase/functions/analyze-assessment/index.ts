import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROK_API_KEY = Deno.env.get('GROK_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // --- STEP 2: Pedagogical Expert (Grok-Beta) ---
    console.log(`[Edge Function] Expert Model...`);
    const finalAnalysisResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { 
            role: "system", 
            content: `Act as a Senior Linguistic Evaluator and Data Architect.
Analyze the following user assessment raw logs and generate a structured JSON response to hydrate the user's dashboard.

Your goal is to provide a "Final Diagnostic State". The output MUST strictly follow this JSON schema to match the Supabase tables:

{
  "learner_profile": {
    "overall_level": "CEFR Level (A1-C2)",
    "points_awarded": 150,
    "accuracy_rate": 85
  },
  "skill_breakdown": [
    {"skill": "reading", "score": 85, "level": "B1"},
    {"skill": "listening", "score": 75, "level": "A2"},
    {"skill": "writing", "score": 90, "level": "B2"},
    {"skill": "speaking", "score": 60, "level": "A2"}
  ],
  "error_profile": {
    "weakness_areas": ["List 3 specific linguistic weaknesses"],
    "common_mistakes": ["List 2-3 specific patterns of error"],
    "action_plan": "A concise, professional 2-sentence roadmap for improvement",
    "bridge_delta": "numeric progress value to next level",
    "bridge_percentage": 45
  },
  "learning_journey": {
    "nodes": [
      {"id": "step_1", "title": "Foundation Mastery", "status": "completed"},
      {"id": "step_2", "title": "Next Milestone Name", "status": "current"},
      {"id": "step_3", "title": "Future Goal", "status": "locked"}
    ]
  },
  "question_analysis": [ 
    {"id": "q1", "skill_tested": "reading", "user_answer": "...", "correct_answer": "...", "result": "Correct", "ai_interpretation": "...", "what_it_tells_us": "..."} 
  ]
}

CRITICAL INSTRUCTIONS:
1. Ensure 'weakness_areas' and 'common_mistakes' are formatted as clean arrays of strings.
2. The 'action_plan' must be actionable and encouraging.
3. If logs are insufficient for a skill, provide a logical estimate based on overall performance.
4. RETURN ONLY RAW JSON. NO PROSE.` 
          },
          { role: "user", content: `[USER_LOGS_START]\n${scoredData}\n[USER_LOGS_END]` }
        ],
        response_format: { type: "json_object" }
      })
    })
    const analysisJSONRaw = await finalAnalysisResponse.json();
    const finalReport = JSON.parse(analysisJSONRaw.choices[0].message.content);

    // --- STEP 3: Full Architecture Persistence Logic ---
    console.log(`[Edge Function] Full Architecture Persistent Save...`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 1. Profile Update
    await supabase.from('learner_profiles').update({
       overall_level: finalReport.learner_profile.overall_level,
       points: finalReport.learner_profile.points_awarded || 50,
       accuracy_rate: finalReport.learner_profile.accuracy_rate || 0,
       has_completed_assessment: true,
       last_active_at: new Date()
    }).eq('id', user_id);

    // 2. Skill States Upsert
    if (finalReport.skill_breakdown && Array.isArray(finalReport.skill_breakdown)) {
       for (const skill of finalReport.skill_breakdown) {
          await supabase.from('skill_states').upsert({
             user_id: user_id,
             skill: skill.skill,
             current_level: skill.level,
             current_score: skill.score,
             confidence: Math.min(skill.score / 100, 1),
             updated_at: new Date()
          }, { onConflict: 'user_id, skill' });
       }
    }

    // 3. Error Profiles Upsert
    const ep = finalReport.error_profile || {};
    await supabase.from('user_error_profiles').upsert({
      user_id: user_id,
      action_plan: ep.action_plan || "",
      weakness_areas: ep.weakness_areas || [],
      common_mistakes: ep.common_mistakes || [],
      bridge_delta: ep.bridge_delta || 0,
      bridge_percentage: ep.bridge_percentage || 0,
      full_report: finalReport
    });

    // 4. Learning Journeys (Insert/Update Journey and Steps)
    if (finalReport.learning_journey && finalReport.learning_journey.nodes) {
       console.log(`[Edge Function] Hydrating Learning Journey...`);
       const { data: journey, error: jError } = await supabase
          .from('learning_journeys')
          .upsert({
             user_id: user_id,
             nodes: finalReport.learning_journey.nodes,
             current_node_id: finalReport.learning_journey.nodes.find((n:any)=>n.status==='current')?.id || 'step_1'
          }, { onConflict: 'user_id' })
          .select('id')
          .single();

       if (jError) {
          console.error(`[Edge Function] Journey Upsert Error: ${jError.message}`);
       }

       if (journey?.id) {
          const journeyId = journey.id;
          // Clear old steps and insert new
          await supabase.from('journey_steps').delete().eq('journey_id', journeyId);
          const stepsToInsert = finalReport.learning_journey.nodes.map((node: any, idx: number) => ({
             journey_id: journeyId,
             title: node.title,
             description: node.title, // or any description if provided
             order_index: idx + 1,
             status: node.status,
             is_locked: node.status === 'locked'
          }));
          await supabase.from('journey_steps').insert(stepsToInsert);
       }
    }

    // 5. Granular Analysis (Question by Question)
    if (finalReport.question_analysis && Array.isArray(finalReport.question_analysis)) {
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
    }

    return new Response(JSON.stringify({ success: true, analysis: finalReport }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error(`[Edge Function Error]: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
