import { supabase } from '../lib/supabaseClient';

export interface DashboardData {
  profile: {
    full_name: string;
    current_level: string;
    xp_points: number;
    streak: number;
  };
  kpis: {
    momentum: number;
    weekly_minutes: number;
    active_errors: number;
    due_reviews: number;
  };
  action_panel: {
    hero: {
      title: string;
      why: string;
      duration: string;
      type: string;
    };
    queue: {
      id: string;
      title: string;
      type: string;
    }[];
  };
  skills: {
    name: string;
    skill: string;
    score: number;
    level: string;
    confidence: number;
  }[];
  trends: {
    date: string;
    speaking: number;
    writing: number;
    reading?: number;
    listening?: number;
  }[];
  intelligence_feed: {
    action_plan: string;
    recent_insights: {
      id: string;
      category: string;
      insight: string;
      timestamp: string;
    }[];
  };
}

export interface JourneyNode {
  id: string;
  title: string;
  description: string;
  type: 'lesson' | 'drill' | 'audit' | string;
  status: 'locked' | 'active' | 'completed';
  skill_focus: string;
  is_locked: boolean;
}

export interface JourneyData {
  journey_id: string;
  nodes: JourneyNode[];
  status: 'active' | 'calibration';
}

export interface IntelligenceProfile {
  identity: {
    name: string;
    summary: string;
    model_confidence: number;
    last_updated: string;
  };
  skill_matrix: {
    name: string;
    score: number;
    level: string;
    confidence: number;
    stability: string;
    trend: string;
    support: string;
  }[];
  error_model: {
    type: string;
    count: number;
    severity: string;
    status: string;
  }[];
  cognitive_state: {
    retention_queue: {
      due_count: number;
      high_risk: string[];
    };
    pacing: {
      tolerance_score: number;
      session_advice: string;
    };
    confidence_trend: number[];
  };
  best_next_move: string;
}

class LearnerService {
  private async getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
  }

  private get baseUrl() {
    return (import.meta as any).env.VITE_API_URL || '';
  }

  async getDashboard(): Promise<DashboardData> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/learner/dashboard`, { headers });
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    return await response.json();
  }

  async getJourney(): Promise<JourneyData> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/learner/journey`, { headers });
    if (!response.ok) throw new Error('Failed to fetch journey');
    return await response.json();
  }

  async getProfile(): Promise<IntelligenceProfile> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/learner/profile`, { headers });
    if (!response.ok) throw new Error('Failed to fetch intelligence profile');
    return await response.json();
  }
}

export const learnerService = new LearnerService();
