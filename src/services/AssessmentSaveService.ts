import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';
import { AssessmentOutcome, AnswerRecord } from '../types/assessment';
import { withRetry, toValidUUID } from '../lib/utils';


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
  /**
   * 🔥 FIRE-AND-FORGET LOGGER: Fully crash-proof — never throws, never blocks UI.
   * Each insert is independently try-caught. Auth failures are swallowed.
   * Failed logs are buffered locally for background sync.
   */
  public static async log_and_update_assessment(task: any, evaluation: any, answer: string, userId?: string, timeSpentMs?: number, audioUrl?: string | null): Promise<{ success: boolean }> {

    // 🛡️ Crash-proof auth resolution
    let finalUserId: string;
    try {
      finalUserId = userId || this.cachedUserId || await this.getAuthenticatedUserIdSafe();
    } catch (authErr) {
      console.warn('[AssessmentSaveService] ⚠️ Auth resolution failed (non-blocking):', authErr);
      return { success: false };
    }

    const answerStr = typeof answer === 'object' ? JSON.stringify(answer) : String(answer || '');
    const questionText = task.prompt || '';
    const skillStr = String(task.skill || "vocabulary").toLowerCase();

    // Production task awareness: writing/speaking use AI scores, not boolean MCQ checks
    const responseMode = (task.response_mode || 'mcq') as string;
    const isProductionTask = responseMode === 'typed' || responseMode === 'audio';
    
    // QUALITY CHECK
    let isQualityIssue = false;
    let qualityReason = '';

    const correctAnswerStr = typeof task.correctAnswer === 'string' ? task.correctAnswer : JSON.stringify(task.correctAnswer || '');

    if (!correctAnswerStr || correctAnswerStr.trim() === '') {
      if (!isProductionTask) {
        isQualityIssue = true;
        qualityReason = 'Empty correct answer in DB';
      }
    }

    if (questionText.toLowerCase().includes('if i had') && correctAnswerStr.toLowerCase() === 'would') {
      isQualityIssue = true;
      qualityReason = 'Third conditional grammar error (would vs would have)';
    }

    if (isQualityIssue) {
      // Fire logic to lower DB trust naturally
      this.lowerQuestionReliability(String(task.id), qualityReason);
      
      // Zero-Score for Errors
      evaluation.is_correct = false; // Zero score
      if (evaluation.score !== undefined) evaluation.score = 0;
    }

    const isCorrect = evaluation.is_correct !== undefined
      ? evaluation.is_correct
      : (evaluation.score || 0) >= 0.5;

    let respSuccess = false;
    let logSuccess = false;

    // 1. ASSESSMENT_RESPONSES — Sanitized Minimal Payload
    try {
      const responsesPayload = {
        user_id: finalUserId,
        question_id: String(task.id),
        user_answer: audioUrl ? `[AUDIO] ${audioUrl} | transcription: ${answerStr}` : answerStr,
        is_correct: isCorrect,
        skill: skillStr,
        category: skillStr, // Alignment: Duplicate skill to category for now
        difficulty: task.difficulty_numeric || 0.5,
        response_time_ms: timeSpentMs || 0,
        status: 'completed',
        explanation: evaluation, // Alignment: Store FULL AI feedback object
      };


      const { error: respError } = await supabase.from('assessment_responses').insert(responsesPayload);

      if (respError) {
        console.warn("[AssessmentSaveService] ⚠️ assessment_responses error (non-blocking):", respError.message);
      } else {
        respSuccess = true;
        console.log(`[AssessmentSaveService] ✅ assessment_responses saved: ${task.id}`);
      }
    } catch (err) {
      console.warn('[AssessmentSaveService] ⚠️ assessment_responses crashed (non-blocking):', err);
    }

    // 2. ASSESSMENT_LOGS — Sanitized Minimal Payload
    try {
        question: questionText, // Alignment: Both 'question' and 'question_text' exist in schema
        question_text: questionText, // Alignment
        user_answer: answerStr || (isProductionTask ? '[pending_evaluation]' : ''),
        correct_answer: correctAnswerStr || (isProductionTask ? '[open_ended]' : ''),
        is_correct: isCorrect,
        skill: skillStr,
        category: skillStr, // Alignment
        score: evaluation.score !== undefined ? evaluation.score : (isCorrect ? 1.0 : 0.0),
        difficulty: task.difficulty_numeric || 0.5,
        response_time_ms: timeSpentMs || 0,
        duration_ms: timeSpentMs || 0, // Alignment
        question_level: task.difficulty || 'b1',
        level: (task as any)._userLevel || 'b1', // Capture snapshot level if passed
        status: 'completed',
        evaluation_metadata: evaluation,
        metadata: {
          audio_url: audioUrl,
          evaluation_source: isProductionTask ? 'ai' : 'deterministic',
          time_spent: timeSpentMs
        }
      };


      // Ensure no undefined values
      const cleanPayload: Record<string, any> = {};
      for (const [key, val] of Object.entries(logsPayload)) {
        if (val !== undefined && val !== null) {
          cleanPayload[key] = val;
        }
      }

      console.log('🚀 CLEAN MINIMAL PAYLOAD:', JSON.stringify(cleanPayload, null, 2));

      const { error: logError } = await supabase.from('assessment_logs').insert(cleanPayload);

      if (logError) {
        console.warn(`[AssessmentSaveService] ⚠️ assessment_logs error (non-blocking):`, logError.message);
        this.saveToLocalBuffer(cleanPayload);
      } else {
        logSuccess = true;
        console.log(`[AssessmentSaveService] ✅ assessment_logs saved: ${task.id}`);
      }
    } catch (err) {
      console.warn('[AssessmentSaveService] ⚠️ assessment_logs crashed (non-blocking):', err);
    }

    // Summary (never throws)
    if (respSuccess && logSuccess) {
      console.log(`[AssessmentSaveService] 🎯 Double-logged question ${String(task.id)} | skill=${skillStr}`);
    }

    return { success: respSuccess && logSuccess };
  }

  /**
   * QUALITY SYSTEM: Lowers the trust score of a buggy question.
   * NOTE: Make sure to run the following SQL snippet in the Supabase Dashboard SQL Editor:
   * ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 100;
   */
  public static async lowerQuestionReliability(questionId: string, reason: string): Promise<void> {
    try {
      console.log(`[AssessmentSaveService] 📉 Lowering question reliability for ${questionId}. Reason: ${reason}`);
      
      // Fetch current score
      const { data: item } = await supabase
        .from('question_bank_items')
        .select('trust_score')
        .eq('id', questionId)
        .single();
        
      const currentScore = item?.trust_score !== undefined ? item.trust_score : 100;
      const newScore = Math.max(0, currentScore - 15);

      const { error } = await supabase
        .from('question_bank_items')
        .update({ 
          trust_score: newScore,
          metadata: { last_flag_reason: reason, quality_issue: newScore < 50 } 
        })
        .eq('id', questionId);

      if (error) throw error;
      console.log(`[AssessmentSaveService] ✅ Reliability lowered. New trust_score: ${newScore}`);
    } catch (err: any) {
      console.warn(`[AssessmentSaveService] ⚠️ Failed to lower question reliability (ignore if trust_score missing):`, err.message);
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
        question_id: toValidUUID(h.questionId),
        user_answer: h.answer,
        score: h.score !== undefined ? h.score : (h.correct ? 1 : 0),
        is_correct: h.correct,
        skill: this.toCanonicalSkill(h.skill),
        category: this.toCanonicalSkill(h.skill),
        difficulty: h.difficulty ?? 0.4,
        question_level: h.questionLevel || h.level || 'b1',
        answer_level: h.userLevel || 'b1',
        response_time_ms: h.responseTimeMs || 0,
        status: 'completed',
        created_at: h.timestamp || new Date().toISOString()
      }));

      // B. user_error_analysis (Incorrect ONLY)
      const errorAnalysisPayload = history.filter(h => !h.correct).map((h, idx) => ({
        user_id: userId,
        category: this.toCanonicalSkill(h.skill),
        user_answer: h.answer,
        correct_answer: h.correctAnswer || '',
        is_correct: false,
        ai_interpretation: `Skill Gap: ${h.skill}`,
        deep_insight: 'Detected in diagnostic flow',
        question_number: idx + 1,
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
          has_completed_assessment: true,
          onboarding_complete: true,
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
      const errorAnalysisPayload = history.filter(h => !h.is_correct).map((h, idx) => {
        const evalMeta = h.evaluation_metadata || {};
        return {
          user_id: userId,
          category: h.category || h.skill,
          user_answer: h.user_answer,
          correct_answer: h.correct_answer || '',
          is_correct: false,
          ai_interpretation: evalMeta.feedback || evalMeta.reasoning || `Skill Gap detected at ${h.category || h.skill}`,
          brief_explanation: evalMeta.feedback || '',
          error_tag: evalMeta.error_tag || '',
          suggested_band: h.question_level || 'A2',
          deep_insight: evalMeta.deep_insight || 'Analyzed during finalization orchestrated pipeline',
          question_number: idx + 1,
          created_at: new Date().toISOString()
        };
      });

      // B. skill_states (Performance Mapping)
       const skillUpserts = Object.keys(outcome.skillBreakdown || {}).map(skillKey => {
         const rawScore = outcome.skillBreakdown[skillKey].score || 0;
         // 🎯 Normalize cleanly: cast to 0-1, then strictly multiply by 10000
         const normalizedScore = Math.round((rawScore > 1 ? rawScore / 100 : rawScore) * 10000);
         const band = outcome.skillBreakdown[skillKey].band;
         return {
           user_id: userId,
           skill: skillKey.toLowerCase(),
           current_level: band,
           level: band, // Alignment
           current_score: normalizedScore,
           confidence: outcome.skillBreakdown[skillKey].confidence,
           last_tested: new Date().toISOString(),
           updated_at: new Date().toISOString()
         };
       });

      // EXECUTION
      const results = await Promise.all([
        // 1. Error Analysis Bulk Insert
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

        // 4. Learner Profile Hydration (Final Step)
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

