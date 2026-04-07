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
  }[];
  isLoading: boolean;
  error: string | null;
}

export const useSupabaseDashboard = () => {
  const [data, setData] = useState<DashboardSupabaseData>({
    user: null,
    profile: null,
    skills: [],
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

        // Fetch learner_profiles and skill_states in parallel
        const [profileRes, skillsRes] = await Promise.all([
          supabase
            .from('learner_profiles')
            .select('id, overall_level, onboarding_complete')
            .eq('id', user.id)
            .single(),
          supabase
            .from('skill_states')
            .select('skill, current_level, confidence')
            .eq('learner_id', user.id),
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
                }
              : null,
            skills: skillsRes.data
              ? skillsRes.data.map((s: any) => ({
                  skill: s.skill,
                  currentLevel: s.current_level || 'A1',
                  confidence: typeof s.confidence === 'number' ? s.confidence : 0,
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
