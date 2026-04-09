import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useData } from '../context/DataContext';

export interface DashboardSupabaseData {
  user: {
    fullName: string;
    email: string;
  } | null;
  profile: {
    currentLevel: string;
    onboardingComplete: boolean;
  } | null;
  skills: {
    skill: string;
    currentLevel: string;
    confidence: number;
    skillId: string;
    masteryScore: number;
    evidenceCount: number;
    isCapped?: boolean;
  }[];
  history: {
    id: string;
    createdAt: string;
    overallLevel: string;
    confidence: number;
  }[];
  errors: {
    category: string;
    description: string;
  }[];
  errorProfile: {
    common_mistakes: any[];
    weakness_areas: string[];
    action_plan?: string[];
    bridge_delta?: string;
    bridge_percentage?: number;
  } | null;
  achievements: {
    id: string;
    name: string;
    type: string;
    earnedAt: string;
  }[];
  isSyncing: boolean;
  isLoading: boolean;
  error: string | null;
  refresh?: () => void;
}

export const useSupabaseDashboard = () => {
  const { refreshTrigger } = useData();
  const [data, setData] = useState<DashboardSupabaseData>({
    user: null,
    profile: null,
    skills: [],
    history: [],
    errors: [],
    errorProfile: null,
    achievements: [],
    isSyncing: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    // ── Auth Listener ────────────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log(`[useSupabaseDashboard] Auth Event: ${event}`);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setRefreshTrigger(prev => prev + 1);
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setData(prev => ({ 
            ...prev, 
            user: null, 
            profile: null, 
            skills: [], 
            history: [], 
            isLoading: false 
          }));
        }
      }
    });

    const fetchDashboardData = async () => {
      if (isMounted) setData(prev => ({ ...prev, isLoading: true }));
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          if (isMounted) setData(prev => ({ ...prev, isLoading: false, error: 'Not authenticated' }));
          return;
        }

        // Fetch learner data in parallel (8-table alignment)
        const [profileRes, skillsRes, historyRes, errorsRes, achievementRes] = await Promise.all([
          supabase
            .from('learner_profiles')
            .select('id, overall_level, onboarding_complete, points, streak')
            .eq('id', user.id)
            .single(),
          supabase
            .from('skill_states')
            .select('skill, current_level, confidence, updated_at')
            .eq('user_id', user.id),
          supabase
            .from('user_error_analysis')
            .select('id, created_at, category, error_rate')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('user_error_profiles')
            .select('weakness_areas, common_mistakes, action_plan, bridge_delta, bridge_percentage')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('user_achievements')
            .select('id, badge_name, earned_at')
            .eq('user_id', user.id)
            .limit(10),
        ]);

        // Circuit Breaker: If any critical fetch fails, signal sync state
        const isSyncing = profileRes.error || skillsRes.error;

        if (isMounted) {
          setData({
            user: {
              fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Learner',
              email: user.email || '',
            },
            profile: profileRes.data
              ? {
                  currentLevel: profileRes.data.overall_level || 'A1',
                  onboardingComplete: profileRes.data.onboarding_complete || false,
                  points: profileRes.data.points || 0,
                  streak: profileRes.data.streak || 0,
                }
              : null,
            skills: skillsRes.data
              ? skillsRes.data.map((s: any) => ({
                  skill: s.skill,
                  currentLevel: s.current_level || 'A1',
                  confidence: typeof s.confidence === 'number' ? s.confidence : 0,
                  skillId: s.skill,
                  masteryScore: (typeof s.confidence === 'number' ? s.confidence : 0) * 100,
                  evidenceCount: 5, // Simulated heuristic
                }))
              : [],
            history: historyRes.data
              ? historyRes.data.map((h: any) => ({
                  id: h.id,
                  createdAt: h.created_at,
                  overallLevel: h.category || 'General', 
                  confidence: h.error_rate !== undefined ? (1 - h.error_rate) : 1,      
                }))
              : [],
            errors: (errorsRes.data as any)?.weakness_areas
              ? (errorsRes.data as any).weakness_areas.map((w: string) => ({
                  category: 'Gap',
                  description: w,
                }))
              : [],
            errorProfile: errorsRes.data
              ? {
                  common_mistakes: Array.isArray((errorsRes.data as any).common_mistakes)
                    ? (errorsRes.data as any).common_mistakes
                    : [],
                  weakness_areas: Array.isArray((errorsRes.data as any).weakness_areas)
                    ? (errorsRes.data as any).weakness_areas
                    : [],
                  action_plan: Array.isArray((errorsRes.data as any).action_plan)
                    ? (errorsRes.data as any).action_plan
                    : [],
                  bridge_delta: (errorsRes.data as any).bridge_delta,
                  bridge_percentage: (errorsRes.data as any).bridge_percentage,
                }
              : null,
            achievements: achievementRes.data
              ? (achievementRes.data as any[]).map((a: any) => ({
                  id: a.id,
                  name: a.badge_name || 'Badge',
                  type: 'Achievement',
                  earnedAt: a.earned_at,
                }))
              : [],
            isSyncing: !!isSyncing,
            isLoading: false,
            error: null,
          });
        }
      } catch (err: any) {
        console.error('[useSupabaseDashboard] Fetch error:', err);
        if (isMounted) setData(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshTrigger]);

  return { ...data };
};

