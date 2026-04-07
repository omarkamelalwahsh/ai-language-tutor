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

        // Fetch learner data in parallel
        const [profileRes, skillsRes, historyRes, errorsRes] = await Promise.all([
          supabase
            .from('learner_profiles')
            .select('id, overall_level, onboarding_complete, points, streak')
            .eq('id', user.id)
            .single(),
          supabase
            .from('skill_states')
            .select('skill, current_level, confidence')
            .eq('user_id', user.id),
          supabase
            .from('assessments')
            .select('id, created_at, overall_level, confidence_score')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('error_profiles')
            .select('skill, context')
            .eq('user_id', user.id)
            .limit(5),
        ]);

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
                  overallLevel: h.overall_level || 'A1',
                  confidence: h.confidence_score || 0.5,
                }))
              : [],
            errors: errorsRes.data
              ? errorsRes.data.map((e: any) => ({
                  category: e.skill || 'General',
                  description: e.context || 'Needs more practice in this area.',
                }))
              : [],
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
