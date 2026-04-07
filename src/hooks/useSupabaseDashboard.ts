import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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
  achievements: {
    id: string;
    name: string;
    type: string;
    earnedAt: string;
  }[];
  isSyncing: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useSupabaseDashboard = () => {
  const [data, setData] = useState<DashboardSupabaseData>({
    user: null,
    profile: null,
    skills: [],
    history: [],
    errors: [],
    achievements: [],
    isSyncing: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
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
            .from('assessment_logs')
            .select('id, created_at, category, is_correct')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('user_error_profiles')
            .select('skill, context')
            .eq('user_id', user.id)
            .limit(5),
          supabase
            .from('user_achievements')
            .select('id, achievement_name, achievement_type, earned_at')
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
                  overallLevel: h.category || 'General', // mapped from assessment_logs.category
                  confidence: h.is_correct ? 1 : 0,      // simplified from logs
                }))
              : [],
            errors: errorsRes.data
              ? errorsRes.data.map((e: any) => ({
                  category: e.skill || 'General',
                  description: e.context || 'Needs more practice in this area.',
                }))
              : [],
            achievements: achievementRes.data
              ? achievementRes.data.map((a: any) => ({
                  id: a.id,
                  name: a.achievement_name,
                  type: a.achievement_type,
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
    };
  }, []);

  return data;
};
