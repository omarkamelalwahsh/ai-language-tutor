import { supabase } from '../lib/supabaseClient';

export interface DashboardData {
  profile: {
    full_name: string;
    current_level: string;
    xp_points: number;
    current_level_xp: number;
    required_xp: number;
    is_gateway_unlocked: boolean;
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
    subject: string;
    count: number;
    severity: string;
    status: string;
    insight?: string;
    examples?: {
      user_answer: string;
      correct_answer: string;
      insight: string;
    }[];
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
    const response = await fetch(`${this.baseUrl}/api/v1/dashboard`, { headers });
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    return await response.json();
  }

  async getJourney(): Promise<JourneyData> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/journey`, { headers });
    if (!response.ok) throw new Error('Failed to fetch journey');
    return await response.json();
  }

  async getProfile(): Promise<IntelligenceProfile> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/profile`, { headers });
    if (!response.ok) throw new Error('Failed to fetch intelligence profile');
    return await response.json();
  }

  async getPracticeTasks(skill: string): Promise<{ skill: string; tasks: any[] }> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/practice/skills/${skill}/tasks`, { headers });
    if (!response.ok) throw new Error('Failed to fetch practice tasks');
    return await response.json();
  }

  async startPracticeSession(skill: string, taskType: string, difficulty: string): Promise<{ session_id: string, message: string }> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/practice/start`, { 
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill, task_type: taskType, difficulty })
    });
    if (!response.ok) throw new Error('Failed to start practice session');
    return await response.json();
  }

  async getWeeklyVocab(): Promise<any> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/daily/weekly-vocab`, { headers });
    if (!response.ok) throw new Error('Failed to fetch weekly vocab');
    return await response.json();
  }

  async getDailyBites(): Promise<any> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/daily/bites`, { headers });
    if (!response.ok) throw new Error('Failed to fetch daily bites');
    const data = await response.json();
    return data.daily_bites || null;
  }

  async recordInteraction(xp: number = 10): Promise<void> {
    const headers = await this.getAuthHeader();
    try {
      await fetch(`${this.baseUrl}/api/v1/daily/record-interaction?xp=${xp}`, { 
        method: 'POST',
        headers 
      });
    } catch (err) {
      console.error("Failed to record interaction", err);
    }
  }

  async updateFcmToken(token: string): Promise<void> {
    const headers = await this.getAuthHeader();
    try {
      await fetch(`${this.baseUrl}/api/v1/notifications/fcm-token`, { 
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch (err) {
      console.error("Failed to update FCM token", err);
    }
  }

  async updateProfile(settings: any): Promise<void> {
    const headers = await this.getAuthHeader();
    const response = await fetch(`${this.baseUrl}/api/v1/profile`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to update profile');
  }
}


export const learnerService = new LearnerService();
