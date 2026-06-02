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
    let apiUrl = (import.meta as any).env.VITE_API_URL;
    if (!apiUrl) {
      console.warn('VITE_API_URL is not set. Frontend API calls will use the current origin.');
      return window.location.origin;
    }

    apiUrl = apiUrl.trim();
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      console.warn(`VITE_API_URL=${apiUrl} does not include a protocol. Prepending https:// for API calls.`);
      apiUrl = `https://${apiUrl}`;
    }

    return apiUrl.replace(/\/$/, '');
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Request failed ${response.status} ${url}: ${bodyText.substring(0, 200)}`);
    }

    if (!contentType.includes('application/json')) {
      const bodyText = await response.text();
      const snippet = bodyText.substring(0, 200);
      throw new Error(`Expected JSON response from ${url}, got ${contentType}. Response body: ${snippet}`);
    }

    try {
      return await response.json();
    } catch (error: any) {
      const bodyText = await response.text();
      throw new Error(`Failed to parse JSON from ${url}: ${error.message}. Response body starts with: ${bodyText.substring(0, 200)}`);
    }
  }

  async getDashboard(): Promise<DashboardData> {
    const headers = await this.getAuthHeader();
    return await this.requestJson<DashboardData>('/api/v1/dashboard', { headers });
  }

  async getJourney(): Promise<JourneyData> {
    const headers = await this.getAuthHeader();
    return await this.requestJson<JourneyData>('/api/v1/journey', { headers });
  }

  async getProfile(): Promise<IntelligenceProfile> {
    const headers = await this.getAuthHeader();
    return await this.requestJson<IntelligenceProfile>('/api/v1/profile', { headers });
  }

  async getPracticeTasks(skill: string): Promise<{ skill: string; tasks: any[] }> {
    const headers = await this.getAuthHeader();
    return await this.requestJson<{ skill: string; tasks: any[] }>(`/api/v1/practice/skills/${skill}/tasks`, { headers });
  }

  async startPracticeSession(skill: string, taskType: string, difficulty: string): Promise<{ session_id: string, message: string }> {
    const headers = await this.getAuthHeader();
    return await this.requestJson<{ session_id: string, message: string }>('/api/v1/practice/start', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill, task_type: taskType, difficulty })
    });
  }

  async getWeeklyVocab(): Promise<any> {
    const headers = await this.getAuthHeader();
    return await this.requestJson<any>('/api/v1/daily/weekly-vocab', { headers });
  }

  async getDailyBites(): Promise<any> {
    const headers = await this.getAuthHeader();
    const data = await this.requestJson<any>('/api/v1/daily/bites', { headers });
    return { bites: data.daily_bites || null, completed: data.completed_bites || [] };
  }

  async completeDailyBite(biteType: string): Promise<void> {
    const headers = await this.getAuthHeader();
    try {
      await fetch(`${this.baseUrl}/api/v1/daily/bites/complete`, { 
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bite_type: biteType })
      });
    } catch (err) {
      console.error("Failed to mark daily bite as complete", err);
    }
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
