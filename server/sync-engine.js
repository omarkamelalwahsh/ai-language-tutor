import { supabase } from "./supabaseClient.js";

function evaluatePerformance(logs) {
  if (!logs || logs.length === 0) return { calculatedLevel: 'A1' };
  
  // Basic heuristic: find highest CEFR level where they were correct, 
  // or default to most common level.
  let validLevels = logs.filter(l => l.is_correct && l.answer_level).map(l => l.answer_level);
  
  if (validLevels.length === 0) {
     return { calculatedLevel: logs[0].answer_level || 'A1' };
  }
  
  // Find mode
  const counts = validLevels.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  
  const mostCommonLevel = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

  return { calculatedLevel: mostCommonLevel };
}

async function triggerBackgroundErrorAnalysis(userId) {
   console.log(`[Sync Engine] Triggering background error analysis for missing data: ${userId}`);
   // In a real application, you might hit the AI route or run inference over `assessment_responses`.
   // Since the server-side AI uses groq, we'd potentially do that logic here.
   // For now, this is a placeholder/stub that could be expanded.
}

export const repairUserConsistency = async (userId) => {
  try {
    // 1. Fetch current profile data
    const { data: profile, error } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.warn(`[Sync Engine] No profile found for ${userId}`, error);
      return;
    }

    // 2. Scenario: User finished onboarding/assessment, but level is "Pending" or missing
    if (profile.onboarding_complete && (!profile.overall_level || profile.overall_level === 'Pending')) {
      console.log(`[Sync Engine] 🔧 Repairing level for user: ${userId}`);
      
      const { data: logs } = await supabase
        .from('assessment_responses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (logs && logs.length > 0) {
        const { calculatedLevel } = evaluatePerformance(logs);

        await supabase
          .from('learner_profiles')
          .update({ overall_level: calculatedLevel })
          .eq('id', userId);
        
        console.log(`[Sync Engine] Level repaired to ${calculatedLevel} for ${userId}`);
          
        // Fill skill states if needed (not executing full RPC here to keep it simple, 
        // rely on future evaluations if needed, or we can stub it)
      }
    }

    // 3. Scenario: Error analysis missing despite having completed assessment
    if (profile.onboarding_complete) {
      const { count, error: errCount } = await supabase
        .from('user_error_analysis')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!errCount && count === 0) {
         await triggerBackgroundErrorAnalysis(userId);
      }
    }

  } catch (err) {
    console.error(`[Sync Engine] Repair failed for user ${userId}`, err);
  }
};
