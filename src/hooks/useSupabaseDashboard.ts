import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface DashboardSupabaseData {
  user: {
    fullName: string;
    email: string;
  } | null;
  profile: {
    currentLevel: string;
    points: number;
    streak: number;
    targetLevel: string;
  } | null;
  skills: {
    skillId: string;
    masteryScore: number;
    evidenceCount: number;
    isCapped: boolean;
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
}

export const useSupabaseDashboard = () => {
  const [data, setData] = useState<DashboardSupabaseData>({
    user: null,
    profile: null,
    skills: [],
    history: [],
    errors: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setData(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // 1. Fetch User Identity, Profile & Skills
        // Since the prompt suggested a Joined Query 'full_name, learner_profiles(*), skill_states(*)',
        // Supabase requires foreign key setups for joined querying like that. We can alternatively 
        // run parallel queries to ensure robustness if schema joins aren't perfectly mapped.
        
        const [profileRes, skillsRes, historyRes, errorsRes] = await Promise.all([
          supabase.from('learner_profiles').select('*').eq('id', user.id).single(),
          supabase.from('skill_states').select('*').eq('learner_id', user.id),
          supabase.from('assessments').select('*').eq('learner_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('error_profiles').select('*').eq('learner_id', user.id).eq('remediation_status', 'active').limit(3)
        ]);

        if (isMounted) {
          setData({
            user: {
              fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Learner',
              email: user.email || ''
            },
            profile: profileRes.data ? {
              currentLevel: profileRes.data.overall_band || 'A1',
              points: profileRes.data.total_points || 0,
              streak: profileRes.data.streak_days || 0,
              targetLevel: profileRes.data.target_band || 'B2'
            } : null,
            skills: skillsRes.data ? skillsRes.data.map((s: any) => ({
              skillId: s.skill,
              masteryScore: s.mastery_score !== null ? s.mastery_score * 100 : 0, // Assume stored as decimal 0-1
              evidenceCount: s.evidence_count || 0,
              isCapped: s.capped_flag || false
            })) : [],
            history: historyRes.data ? historyRes.data.map((h: any) => ({
              id: h.id,
              createdAt: h.created_at,
              overallLevel: h.overall_level,
              confidence: h.confidence_score
            })) : [],
            errors: errorsRes.data ? errorsRes.data.map((e: any) => ({
              category: e.error_category,
              description: e.error_description || "Consistent mistakes noted by AI Assessor."
            })) : [],
            isLoading: false
          });
        }
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
        if (isMounted) setData(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  return data;
};
