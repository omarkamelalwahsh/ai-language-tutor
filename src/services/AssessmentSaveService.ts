import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';
import { AssessmentOutcome, AnswerRecord } from '../types/assessment';
import { withRetry } from '../lib/utils';


export class AssessmentSaveService {
  private static cachedUserId: string | null = null;
  private static cachedToken: string | null = null;

  /**
   * Warm up the Auth cache to eliminate 500ms+ latency during assessment.
   */
  public static async warmupAuth(): Promise<string | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        this.cachedUserId = user.id;
        
        // Warm up the token for Edge Function calls (Model B / Grok)
        const authStorage = localStorage.getItem('sb-' + (new URL(supabaseUrl!).hostname.split('.')[0]) + '-auth-token');
        this.cachedToken = authStorage ? JSON.parse(authStorage)?.access_token : null;
        
        console.log("⚡ [AuthCache] Session warmed up and cached.");
        return user.id;
      }
    } catch (e) {
      console.warn("⚠️ [AuthCache] Warmup failed:", e);
    }
    return null;
  }

  /**
   * Helper to ensure valid user session before DB interaction.
   */
  public static async getAuthenticatedUserIdSafe(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error(`Auth context missing: ${error?.message || 'No user session'}`);
    }
    this.cachedUserId = user.id;
    return user.id;
  }

  private static async getAuthenticatedUserId(): Promise<string> {
    return this.getAuthenticatedUserIdSafe();
  }

  /**
   * Utility to ensure deterministic UUIDs from string question IDs (e.g. B1_L_01)
   */
  private static toValidUUID(id: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) return id;

    // Use a fixed namespace (e.g. hash of project name) + deterministic hash
    let hash = 0;
    const namespace = "ai-language-tutor-v2";
    const combined = namespace + id;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; 
    }
    const hex = Math.abs(hash).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`; 
  }

  /**
   * Utility to map raw skill tags (e.g. 'speaking-1') to canonical categories.
   */
  private static toCanonicalSkill(skillRaw: string): string {
    const s = (skillRaw || '').toLowerCase();
    if (s.includes('speak')) return 'speaking';
    if (s.includes('read')) return 'reading';
    if (s.includes('writ')) return 'writing';
    if (s.includes('listen')) return 'listening';
    if (s.includes('vocab') || s.includes('word')) return 'vocabulary';
    if (s.includes('gramm')) return 'grammar';
    return s;
  }

  /**
   * JOURNEY FACTORY: Generates initial nodes based on CEFR level.
   * Total 36 nodes (6 per level).
   */
  private static generateInitialJourneyNodes(level: string): { nodes: any[], currentNodeId: string } {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C2+'];
    const nodesPerLevel = 6;
    const nodes: any[] = [];
    
    // Find index of current level (fallback to A1 if invalid)
    const levelIndex = Math.max(0, levels.indexOf(level.replace('+', '')));
    const currentStartNodeIndex = levelIndex * nodesPerLevel;
    let currentNodeId = "";

    levels.slice(0, 6).forEach((lvl, lIdx) => {
      for (let i = 1; i <= nodesPerLevel; i++) {
        const globalIdx = (lIdx * nodesPerLevel) + i;
        const nodeId = `node_${globalIdx}`;
        const isCompleted = globalIdx <= currentStartNodeIndex;
        const isCurrent = globalIdx === currentStartNodeIndex + 1;
        
        if (isCurrent) currentNodeId = nodeId;

        nodes.push({
          id: nodeId,
          title: `${lvl} ${i}: ${i === 1 ? 'Foundations' : 'Intermediate Practice'}`,
          level: lvl,
          status: isCompleted ? 'completed' : (isCurrent ? 'available' : 'locked'),
          order: globalIdx,
          points: 100
        });
      }
    });

    return { nodes, currentNodeId: currentNodeId || "node_1" };
  }

  // Helper buffers unchanged...
  private static saveToLocalBuffer(payload: any) {
    if (typeof window === 'undefined') return;
    try {
      const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
      buffer.push(payload);
      localStorage.setItem('pending_assessment_logs', JSON.stringify(buffer));
    } catch (e) {
      console.warn('[Buffer] Failed to save to local buffer:', e);
    }
  }

  private static removeFromLocalBuffer(questionId: string, timestamp: string) {
    if (typeof window === 'undefined') return;
    try {
      const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
      const filtered = buffer.filter((log: any) => !(log.question_id === questionId && log.created_at === timestamp));
      localStorage.setItem('pending_assessment_logs', JSON.stringify(filtered));
    } catch (e) {
      console.warn('[Buffer] Failed to remove from local buffer:', e);
    }
  }

  public static async syncPendingLogs() {
    if (typeof window === 'undefined') return true;

    const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
    if (buffer.length === 0) return true;

    console.log(`[Buffer] 🔄 Background Sync: Attempting to secure ${buffer.length} logs...`);

    try {
      // Reverting to assessment_logs as verified in DB
      const { error } = await supabase.from('assessment_logs').insert(buffer);
      if (error) throw error;

      localStorage.removeItem('pending_assessment_logs');
      console.log(`[Buffer] ✅ Background Sync complete. ${buffer.length} logs secured.`);
    } catch (err) {
      console.error(`[Buffer] ❌ Background Sync failed:`, err);
      throw err;
    }

    return true;
  }

  /**
   * LIGHTNING LOGGER: Non-blocking Fire-and-Forget orchestration.
   */
  public static async log_and_update_assessment(task: any, evaluation: any, answer: string, userId?: string, timeSpentMs?: number) {
    const finalUserId = userId || this.cachedUserId || await this.getAuthenticatedUserIdSafe();
    
    // Logic for difficulty mapping
    const DIFF_MAP: Record<string, number> = {
      'a1': 0.1, 'a2': 0.2,
      'b1': 0.4, 'b2': 0.6,
      'c1': 0.8, 'c2': 1.0
    };
    const rawLevel = (task.difficulty || task.target_cefr || 'b1');
    const canonicalLevel = String(rawLevel).toLowerCase();
    const difficultyVal = task.difficulty_num || DIFF_MAP[canonicalLevel] || 0.4;

    const payload = {
      user_id: finalUserId,
      question_id: String(task.id),
      question_text: task.prompt,
      user_answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer),
      correct_answer: task.correctAnswer || '',
      is_correct: evaluation.is_correct || evaluation.score >= 0.5,
      skill: String(task.skill || "vocabulary").toLowerCase(),
      question_level: canonicalLevel,
      difficulty: difficultyVal,
      score: (evaluation.score || 0) * difficultyVal,
      time_spent_ms: timeSpentMs || 0,
      evaluation_metadata: evaluation,
      status: (evaluation as any).status || 'evaluated',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Log to assessment_responses (Historical record)
      const { error: respError } = await supabase.from('assessment_responses').insert({
        user_id: payload.user_id,
        question_id: payload.question_id,
        user_answer: payload.user_answer,
        is_correct: payload.is_correct,
        skill: payload.skill,
        question_level: payload.question_level,
        difficulty: payload.difficulty,
        response_time_ms: payload.time_spent_ms
      });
      
      if (respError) console.error("[AssessmentSaveService] ❌ assessment_responses error:", respError.message);

      // 2. Log to assessment_logs (Session trace)
      const { error: logError } = await supabase.from('assessment_logs').insert(payload);
      
      if (logError) {
        console.error(`[AssessmentSaveService] ❌ Failed to log to assessment_logs:`, logError.message);
        this.saveToLocalBuffer(payload);
      } else {
        console.log(`[AssessmentSaveService] ✅ Double-logged question ${payload.question_id} successfully.`);
      }

      return { success: true };
    } catch (err) {
      console.error('[AssessmentSaveService] ❌ Persistence error:', err);
      this.saveToLocalBuffer(payload);
      return { success: false, error: err };
    }
  }

  /**
   * IMMEDIATE PERSISTENCE: Creates the session as soon as battery is formed.
   */
  public static async createSession(assessmentId: string, userId: string | undefined | null, batterySize: number, contextData?: any) {
    const finalUserId = userId || this.cachedUserId || await this.getAuthenticatedUserIdSafe();
    console.log('--- STARTING ASSESSMENT SAVE ---');
    console.log(`[AssessmentSaveService] 🔄 Creating session record for ${assessmentId} (User: ${finalUserId})...`);
    
    try {
      const { error } = await supabase
        .from('assessments')
        .upsert({
          id: assessmentId,
          user_id: finalUserId,
          current_index: 0,
          evaluation_metadata: { 
            status: 'architected', 
            size: batterySize,
            context: contextData || null 
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error('[AssessmentSaveService] ❌ Failed to create session:', error);
        throw error;
      }
      
      console.log(`[AssessmentSaveService] ✅ Session POST request successful.`);
      return assessmentId;
    } catch (err) {
      console.error('[AssessmentSaveService] ❌ Session creation exception:', err);
      return null;
    }
  }

  /**
   * PERSISTENCE SYNC: Saves the entire engine state to the database.
   * This is triggered at block boundaries to ensure cross-device persistence.
   */
  public static async saveAssessmentState(assessmentId: string, state: any, userId?: string) {
    const finalUserId = userId || this.cachedUserId || await this.getAuthenticatedUserIdSafe();
    
    console.log(`[AssessmentSaveService] 🔄 Syncing state to remote for assessment: ${assessmentId} (User: ${finalUserId})`);
    
    try {
      const { error } = await supabase
        .from('assessments')
        .upsert({
          id: assessmentId,
          user_id: finalUserId,
          current_index: state.currentIndex,
          evaluation_metadata: state, // Store full state blob for recovery
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error('[AssessmentSaveService] ❌ Remote state sync failed:', error);
      }
    } catch (err) {
      console.error('[AssessmentSaveService] ❌ Sync exception:', err);
    }
  }

  /**
   * RECOVERY ENGINE: Fetches the most recent pending assessment state for a user.
   */
  public static async getLatestAssessmentState(userId: string): Promise<any | null> {
    console.log(`[AssessmentSaveService] 🔍 Searching for remote state for user: ${userId}`);
    
    try {
      const { data, error } = await supabase
        .from('assessments')
        .select('evaluation_metadata')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data?.evaluation_metadata) return null;

      const state = data.evaluation_metadata;
      if (!state.battery || state.currentIndex >= state.battery.length) {
        console.log("[AssessmentSaveService] ℹ️ Found state is either complete or invalid.");
        return null;
      }

      console.log(`[AssessmentSaveService] ✅ Remote state found: ${state.assessmentId} at Q${state.currentIndex + 1}`);
      return state;
    } catch (err) {
      console.error('[AssessmentSaveService] ❌ Remote recovery failed:', err);
      return null;
    }
  }


  /**
   * PRODUCTION-READY: Advanced Assessment Finalization Logic
   * Orchestrates 5 tables with historical context and cumulative merging.
   */
  public static async saveAssessmentComprehensive(payload: {
    history: AnswerRecord[];
    outcome: AssessmentOutcome;
    evaluations?: any;
    userId?: string;
  }): Promise<void> {
    const { history, outcome, evaluations, userId: providedUserId } = payload;
    const grokAnalysis = outcome.aiAnalysis || evaluations;
    
    // 🛡️ User ID Resilience: Use provided, fallback to current session
    const userId = providedUserId || await this.getAuthenticatedUserId();
    console.log(`[Architecture] 🏗️ Launching Comprehensive Save for user: ${userId}`);

    try {
      // 1. Fetch Historical Context (Parallel)
      const [oldProfileRes, oldErrorsRes] = await Promise.all([
        supabase.from('learner_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_error_profiles').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const oldProfile = oldProfileRes.data;
      const oldErrors = oldErrorsRes.data || { weakness_areas: [], action_plan: "" };

      // 2. LOGIC: Merge Weaknesses & Create Cumulative Action Plan
      const { combinedWeaknesses, cumulativeActionPlan } = this.mergeHistoricalContext(
        oldErrors, 
        grokAnalysis?.weaknesses || outcome.weaknesses || [],
        grokAnalysis?.actionPlan || outcome.actionPlan || ""
      );

      // 3. PERSISTENCE: Orchestrated Sequential Operations
      
      // A. assessment_responses (Every Q/A)
      const responsesPayload = history.map(h => ({
        user_id: userId,
        question_id: this.toValidUUID(h.questionId),
        user_answer: h.answer,
        score: h.score !== undefined ? h.score : (h.isCorrect ? 1 : 0),
        is_correct: h.isCorrect ?? (h as any).correct,
        skill: this.toCanonicalSkill(h.skill),
        difficulty: h.difficulty ?? 0.4,
        question_level: h.level || 'b1',
        created_at: h.timestamp || new Date().toISOString()
      }));

      // B. user_error_analysis (Incorrect ONLY)
      const errorAnalysisPayload = history.filter(h => !(h.isCorrect ?? (h as any).correct)).map(h => ({
        user_id: userId,
        category: this.toCanonicalSkill(h.skill),
        user_answer: h.answer,
        correct_answer: h.correctAnswer || '',
        is_correct: false,
        ai_interpretation: `Skill Gap: ${h.skill}`,
        deep_insight: 'Detected in diagnostic flow',
        created_at: new Date().toISOString()
      }));

      // C. skill_states (Performance Upsert)
       const skillUpserts = Object.keys(outcome.skillBreakdown || {}).map(skillName => {
         const skillKey = skillName.toLowerCase();
         const rawScore = outcome.skillBreakdown[skillName].score || 0;
         // 🎯 Normalize cleanly: cast to 0-1, then strictly multiply by 10000
         const normalizedScore = Math.round((rawScore > 1 ? rawScore / 100 : rawScore) * 10000);
         return {
           user_id: userId,
           skill: skillKey,
           current_level: outcome.skillBreakdown[skillName].band,
           current_score: normalizedScore,
           confidence: outcome.skillBreakdown[skillName].confidence,
           last_tested: new Date().toISOString(),
           updated_at: new Date().toISOString()
         };
       });

      // EXECUTION (Sequential Orchestration)
      console.log("🟠 Executing Sequential Inserts...");

      const results = await Promise.all([
        // 1. Insert detailed responses (UUID safety enforced by toValidUUID)
        supabase.from('assessment_responses').upsert(responsesPayload, { onConflict: 'id', ignoreDuplicates: true }),
        
        // 2. Insert error analysis for failures
        errorAnalysisPayload.length > 0 
          ? supabase.from('user_error_analysis').upsert(errorAnalysisPayload, { ignoreDuplicates: true }) 
          : Promise.resolve({ error: null }),
        
        // 3. Update Proficiency Matrix
        supabase.from('skill_states').upsert(skillUpserts, { onConflict: 'user_id, skill' }),
        
        // 4. Update Core Profile (Atomic points increment simulated via fetch+write)
        supabase.from('learner_profiles').update({
          overall_level: (outcome as any).finalLevel || (outcome as any).overallBand || 'B1',
          points: (oldProfile?.points || 0) + ((outcome as any).pointsAwarded || 50),
          onboarding_complete: true,
          has_completed_assessment: true,
          updated_at: new Date().toISOString()
        }).eq('id', userId),
        
        // 5. Upsert Merged Intelligence Profile (Merging Logic applied)
        supabase.from('user_error_profiles').upsert({
          user_id: userId,
          weakness_areas: combinedWeaknesses,
          action_plan: cumulativeActionPlan,
          full_report: grokAnalysis || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      ]);

      // Error Boundary Check
      const errors = results.filter(r => (r as any).error).map(r => (r as any).error);
      if (errors.length > 0) {
        console.error("❌ Some operations failed in comprehensive save:", errors);
        throw errors[0];
      }

      console.log('✅ [Architecture] Comprehensive Save SUCCESS.');
    } catch (err) {
      console.error('🔥 [Architecture] Critical Failure in Comprehensive Save:', err);
      throw err;
    }
  }

  /**
   * Private merging engine for historical alignment.
   */
  private static mergeHistoricalContext(oldData: any, newWeaknesses: string[], newActionPlan: string | string[]) {
    const historicalWeaknesses = oldData.weakness_areas || [];
    const combinedSet = new Set([...historicalWeaknesses]);
    
    // Identify recurring issues to weight them in the plan
    const recurring = newWeaknesses.filter(w => 
      historicalWeaknesses.some((hw: string) => hw.toLowerCase() === w.toLowerCase())
    );

    newWeaknesses.forEach(w => combinedSet.add(w));

    const finalWeaknesses = Array.from(combinedSet);
    const incomingPlan = Array.isArray(newActionPlan) ? newActionPlan.join('\n') : newActionPlan;
    
    let cumulativePlan = incomingPlan;
    if (recurring.length > 0) {
      cumulativePlan = `> [!IMPORTANT]\n> **RECURRING WEAKNESSES DETECTED:** ${recurring.join(', ')}\n\n` + cumulativePlan;
    }
    
    if (oldData.action_plan && oldData.action_plan !== incomingPlan) {
      cumulativePlan += `\n\n---\n**Previous Action Items:**\n${oldData.action_plan}`;
    }

    return { 
      combinedWeaknesses: finalWeaknesses, 
      cumulativeActionPlan: cumulativePlan 
    };
  }

  // Legacy saveAssessmentResults was removed in favor of saveAssessmentComprehensive orchestration.

  /**
   * Invokes the Grok-powered cloud analysis pipeline.
   * Orchestrates Scorer-Model and Pedagogical Expert via Edge Function.
   */
  public static async analyzeAssessmentRemote(history: AnswerRecord[]): Promise<any> {
    try {
      const userId = this.cachedUserId || await this.getAuthenticatedUserId();
      console.log(`[AssessmentSave] ☁️ Triggering Deep Cloud Analysis (Model B) for: ${userId}`);

      // 🛡️ Robust Token Retrieval: Use official helper
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error("Authentication session expired.");

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey!
        },
        body: JSON.stringify({
          user_id: userId,
          user_answers: history.map(h => ({
            question_id: h.questionId,
            skill: h.skill,
            user_answer: h.answer,
            expected: h.correctAnswer,
            time: h.responseTimeMs
          }))
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[AssessmentSave] Cloud Analysis Error:', errText);
        throw new Error(`AI Analysis Failed: ${errText}`);
      }

      const result = await response.json();
      console.log('[AssessmentSave] ✅ Cloud Analysis complete.', result);
      return result.analysis;
    } catch (err) {
      console.error('[AssessmentSave] Remote Analysis Exception:', err);
      throw err;
    }
  }

  /**
   * Dedicated helper for single-skill updates (Proctor direct update).
   * Ensures atomic UPSERT and Integer Weighting.
   */
  public static async updateSkillState(userId: string, skillName: string, confidence: number, level?: string): Promise<void> {
    await withRetry(async () => {
      const resolvedLevel = level || 'A1';
      const { error } = await supabase
        .from('skill_states')
        .upsert(
          {
            user_id: userId,
            skill: (skillName || 'unknown').toLowerCase(),
            current_score: Math.round((confidence || 0.5) * 10000),
            confidence: confidence ?? 0.5,
            current_level: resolvedLevel,
            level: resolvedLevel,
            updated_at: new Date().toISOString(),
            last_tested: new Date().toISOString()
          },
          { onConflict: 'user_id, skill' }
        );

      if (error) throw error;
    });
  }

  /**
   * Updates journey step status following strict transition rules.
   * Rule 3.2.4: Update journey_steps.status to 'completed'.
   */
  public static async updateJourneyStepStatus(stepId: string, status: 'locked' | 'available' | 'current' | 'completed'): Promise<void> {
    await withRetry(async () => {
      const { error } = await supabase
        .from('journey_steps')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepId);

      if (error) throw error;
      console.log(`[AssessmentSave] 🏁 Journey step ${stepId} status: ${status}`);
    });
  }

  /**
   * ENTERPRISE ORCHESTRATION: The Big Sync Function
   * Finalizes the entire diagnostic flow, hydrating all tables and starting the journey.
   */
  public static async finalizeFullDiagnostic(
    outcome: AssessmentOutcome, 
    grokAnalysis: any
  ): Promise<{ success: true, newLevel: string, journeyStarted: boolean }> {
    const userId = await this.getAuthenticatedUserId();
    console.log(`[Architecture] 🚀 Finalizing Diagnostic Journey for user: ${userId}`);

    try {
      // 1. Ensure Background Sync is clean
      await this.syncPendingLogs();

      // 2. Fetch Sync Status & Context
      const [historyRes, oldProfileRes, oldErrorRes] = await Promise.all([
        supabase.from('assessment_logs').select('*').eq('user_id', userId),
        supabase.from('learner_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_error_profiles').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const history = historyRes.data || [];
      const oldProfile = oldProfileRes.data;
      const oldErrors = oldErrorRes.data || { weakness_areas: [], action_plan: "" };

      // 3. Logic: Merge Weaknesses & Cumulative Plan
      const newLevel = outcome.finalLevel || outcome.overallBand || 'B1';
      const { combinedWeaknesses, cumulativeActionPlan } = this.mergeHistoricalContext(
        oldErrors,
        grokAnalysis?.weaknesses || outcome.weaknesses || [],
        grokAnalysis?.actionPlan || outcome.actionPlan || ""
      );

      // 4. Persistence: Sequential Orchestration
      console.log("🟠 Hydrating multi-table ecosystem...");

      // A. user_error_analysis (Failures Only)
      const errorAnalysisPayload = history.filter(h => !h.is_correct).map(h => ({
        user_id: userId,
        category: h.category,
        user_answer: h.user_answer,
        correct_answer: h.correct_answer || '',
        is_correct: false,
        ai_interpretation: `Skill Gap detected at ${h.category}`,
        deep_insight: 'Analyzed during finalization orchestrated pipeline',
        created_at: new Date().toISOString()
      }));

      // B. skill_states (Performance Mapping)
       const skillUpserts = Object.keys(outcome.skillBreakdown || {}).map(skillKey => {
         const rawScore = outcome.skillBreakdown[skillKey].score || 0;
         // 🎯 Normalize cleanly: cast to 0-1, then strictly multiply by 10000
         const normalizedScore = Math.round((rawScore > 1 ? rawScore / 100 : rawScore) * 10000);
         return {
           user_id: userId,
           skill: skillKey.toLowerCase(),
           current_level: outcome.skillBreakdown[skillKey].band,
           current_score: normalizedScore,
           confidence: outcome.skillBreakdown[skillKey].confidence,
           last_tested: new Date().toISOString(),
           updated_at: new Date().toISOString()
         };
       });

      // C. Journey Factory Initialization
      const { nodes, currentNodeId } = this.generateInitialJourneyNodes(newLevel);

      // EXECUTION
      const results = await Promise.all([
        // 1. Error Analysis Bulk Insert (use upsert to prevent 409 conflict)
        errorAnalysisPayload.length > 0 
          ? supabase.from('user_error_analysis').upsert(errorAnalysisPayload, { ignoreDuplicates: true }) 
          : Promise.resolve({ error: null }),

        // 2. Cumulative Intelligence Refresh
        supabase.from('user_error_profiles').upsert({
          user_id: userId,
          weakness_areas: combinedWeaknesses,
          action_plan: cumulativeActionPlan,
          full_report: grokAnalysis || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' }),

        // 3. Skill Matrices Refresh
        supabase.from('skill_states').upsert(skillUpserts, { onConflict: 'user_id, skill' }),

        // 4. Learning Journey Initialization
        supabase.from('learning_journeys').upsert({
          user_id: userId,
          nodes: nodes,
          current_node_id: currentNodeId,
          metadata: { initial_level: newLevel, generated_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' }),

        // 5. Learner Profile Hydration (Final Step)
        supabase.from('learner_profiles').update({
          overall_level: newLevel,
          onboarding_complete: true,
          has_completed_assessment: true,
          points: (oldProfile?.points || 0) + 500, // Diagnostic Completion Bonus
          updated_at: new Date().toISOString()
        }).eq('id', userId)
      ]);

      // Final Check
      const errors = results.filter(r => (r as any).error).map(r => (r as any).error);
      if (errors.length > 0) throw errors[0];

      console.log('✅ [Architecture] Full Diagnostic Finalization Complete.');
      return { success: true, newLevel: String(newLevel), journeyStarted: true };
    } catch (err) {
      console.error('🔥 [Architecture] Finalization Pipeline CRASHED:', err);
      throw err;
    }
  }
}

