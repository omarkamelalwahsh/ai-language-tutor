import { supabase } from '../lib/supabaseClient';
import { resolveApiBase } from '../lib/apiBase';

const API_URL = resolveApiBase((import.meta as any).env.VITE_API_URL || 'http://localhost:8000');
const API_PREFIX = `${API_URL}/api/v1/tasks`;

// ---------------------------------------------------------------------------
// Types matching the backend SessionManager contract
// ---------------------------------------------------------------------------

export interface SessionTaskMetadata {
  id: string;
  type: string;
  slot_role?: 'review' | 'journey' | 'maintenance' | 'targeted';
  skill?: string;
  skill_tag?: string;
  difficulty_score?: number;
  is_fallback?: boolean;
}

export interface SessionTaskContent {
  instruction: string;
  stimulus: string;
  task_prompt?: string;
  target_response?: string;
  fragments?: string[];
  options?: string[];
  masked_sentence?: string;
  vocabulary_used?: string[];
  explanation?: string;
  audio_url?: string;
  image_url?: string;
}

export interface SessionTask {
  task_metadata: SessionTaskMetadata;
  content: SessionTaskContent;
}

export interface SessionPlanSlot {
  slot: string;
  skill: string;
  difficulty: number;
}

export interface JourneyFocus {
  step_id: string | null;
  title: string | null;
  skill_focus: string | null;
  order_index: number | null;
}

export interface SessionBatch {
  session_type: 'daily_mix' | 'skill_practice';
  user_level: string;
  journey_focus: JourneyFocus;
  plan: SessionPlanSlot[];
  tasks: SessionTask[];
  skill?: string;
}

export interface TaskResult {
  skill: string;
  score: number;
  is_correct: boolean;
  task_metadata?: SessionTaskMetadata;
  error_category?: string | null;
}

export interface SessionCompletePayload {
  session_type: 'daily_mix' | 'skill_practice';
  results: TaskResult[];
  completed_journey_step_id?: string | null;
}

export interface SkillPromotion {
  skill: string;
  before: string;
  after: string;
}

export interface UnlockedJourneyStep {
  id: string;
  title: string;
  skill_focus: string | null;
  order_index: number;
}

export interface SessionCompleteResponse {
  status: 'ok' | 'noop';
  reason?: string;
  tasks_recorded?: number;
  skill_summary?: Record<string, { count: number; sum: number; correct: number; avg_score: number; accuracy: number }>;
  skill_promotions?: SkillPromotion[];
  unlocked_journey_step?: UnlockedJourneyStep | null;
  errors_logged?: number;
}

export interface EvaluateTaskRequest {
  task_metadata: {
    type?: string;
    skill?: string;
    level?: string;
    difficulty_score?: number;
  };
  content: {
    instruction?: string;
    stimulus?: string;
    task_prompt?: string;
    target_response?: string;
    explanation?: string;
  };
  user_response: string;
}

export interface EvaluateTaskResponse {
  score: number;
  is_correct: boolean;
  evaluation_mode: 'closed' | 'open';
  detected_level?: string;
  detailed_feedback?: string;
  reasoning_summary?: string;
  dimensions?: {
    grammar: number;
    vocabulary: number;
    coherence: number;
  };
  error_analysis?: {
    detected_errors?: string[];
    corrected_version?: string | null;
    error_category?: string | null;
  };
  is_fallback?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

export const sessionService = {
  /** Smart Daily Mix — 5 tasks (review × 2, journey × 2, maintenance × 1). */
  async buildDailyMix(): Promise<SessionBatch> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_PREFIX}/daily-mix`, { method: 'POST', headers });
    if (!res.ok) throw new Error(`Daily mix failed: ${res.status} ${await res.text()}`);
    return res.json();
  },

  /** Targeted skill practice — 5 progressive tasks on one skill. */
  async buildSkillPractice(skill: string, count: number = 5): Promise<SessionBatch> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_PREFIX}/skill-practice`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ skill, count }),
    });
    if (!res.ok) throw new Error(`Skill practice failed: ${res.status} ${await res.text()}`);
    return res.json();
  },

  /** Closes the loop: writes results back to learner_profiles, skill_states, journey_steps, error_profiles. */
  async submitSessionResults(payload: SessionCompletePayload): Promise<SessionCompleteResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_PREFIX}/session-complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Session-complete failed: ${res.status} ${await res.text()}`);
    return res.json();
  },

  /** CEFR-aware grading for one learner response. Used for open-ended tasks where string-match is meaningless. */
  async evaluateTask(payload: EvaluateTaskRequest): Promise<EvaluateTaskResponse> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_PREFIX}/evaluate-task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`evaluate-task failed: ${res.status} ${await res.text()}`);
    return res.json();
  },

  /** Incremental sync: writes a single task result back to the DB immediately. */
  async syncTaskResult(result: TaskResult): Promise<{ status: string; skill: string; is_correct: boolean }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_PREFIX}/sync-task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(result),
    });
    if (!res.ok) throw new Error(`sync-task failed: ${res.status} ${await res.text()}`);
    return res.json();
  },
};
