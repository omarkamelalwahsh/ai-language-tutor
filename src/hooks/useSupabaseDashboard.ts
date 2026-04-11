import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useData } from '../context/DataContext';
import { DB_SCHEMA } from '../constants/dbSchema';

export interface DashboardSupabaseData {
  user: {
    fullName: string;
    email: string;
  } | null;
  profile: {
    currentLevel: string;
    onboardingComplete: boolean;
    points: number;
    streak: number;
    pacingScore: number;
    accuracyRate: number;
    selfCorrectionRate: number;
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
  persistedJourney: {
    nodes: any[];
    currentNodeId: string | null;
    updatedAt: string;
  } | null;
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
    persistedJourney: null,
    isSyncing: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      if (isMounted) setData(prev => ({ ...prev, isLoading: true }));
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          if (isMounted) setData(prev => ({ ...prev, isLoading: false, error: 'Not authenticated' }));
          return;
        }

        // Fetch learner data in parallel (Joined Fetch for Profiles & Skills)
        const [joinedRes, historyRes, errorsRes, achievementRes, journeyRes, stepsRes, skillsRes] = await Promise.all([
          supabase
            .from('learner_profiles')
            .select(`
              id, 
              ${DB_SCHEMA.COLUMNS.LEVEL}, 
              ${DB_SCHEMA.COLUMNS.ONBOARDING}, 
              ${DB_SCHEMA.COLUMNS.POINTS}, 
              streak,
              pacing_score,
              accuracy_rate,
              self_correction_rate
            `)
            .eq('id', user.id)
            .single(),
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
          supabase
            .from('learning_journeys')
            .select('id, current_node_id, updated_at')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('journey_steps')
            .select('id, journey_id, title, description, status, order_index, icon_type')
            .order('order_index', { ascending: true }),
          supabase
            .from(DB_SCHEMA.TABLES.SKILLS)
            .select(`skill, current_level, ${DB_SCHEMA.COLUMNS.SKILL_SCORE}, confidence, updated_at`)
            .eq('user_id', user.id)
        ]);

        // Circuit Breaker: If any critical fetch fails, signal sync state
        const isSyncing = joinedRes.error;

        if (isMounted) {
          const profileData = joinedRes.data;
          const skillsData = skillsRes.data || [];
          const journeyData = journeyRes.data;
          const journeySteps = stepsRes.data?.filter(s => s.journey_id === journeyData?.id) || [];

          setData({
            user: {
              fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Learner',
              email: user.email || '',
            },
            profile: profileData
              ? {
                  currentLevel: profileData[DB_SCHEMA.COLUMNS.LEVEL] || 'A1',
                  onboardingComplete: profileData[DB_SCHEMA.COLUMNS.ONBOARDING] || false,
                  points: profileData[DB_SCHEMA.COLUMNS.POINTS] || 0,
                  streak: profileData.streak || 0,
                  pacingScore: profileData.pacing_score || 0,
                  accuracyRate: profileData.accuracy_rate || 0,
                  selfCorrectionRate: profileData.self_correction_rate || 0,
                }
              : null,
            skills: skillsData.map((s: any) => ({
              skill: s.skill,
              currentLevel: s.current_level || 'A1',
              confidence: typeof s.confidence === 'number' ? s.confidence : ((s[DB_SCHEMA.COLUMNS.SKILL_SCORE] || 0) / 10000),
              skillId: s.skill,
              masteryScore: s[DB_SCHEMA.COLUMNS.SKILL_SCORE] ? (s[DB_SCHEMA.COLUMNS.SKILL_SCORE] / 100) : ((s.confidence || 0) * 100),
              evidenceCount: 5, 
            })),
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
            persistedJourney: journeyData ? {
              nodes: journeySteps.map(s => ({
                id: s.id,
                title: s.title,
                description: s.description,
                status: s.status,
                orderIndex: s.order_index,
                iconType: s.icon_type
              })),
              currentNodeId: journeyData.current_node_id,
              updatedAt: journeyData.updated_at,
            } : null,
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
  }, [refreshTrigger]);

  return { ...data };
};

