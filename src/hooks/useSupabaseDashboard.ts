import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useData } from '../context/DataContext';
import { DB_SCHEMA } from '../constants/dbSchema';

export interface DashboardSupabaseData {
  user: {
    fullName: string;
    email: string;
  } | null;
  profile: {
    overall_level: string;
    full_name: string;
    onboardingComplete: boolean;
    points: number;
    streak: number;
    pacingScore: number;
    accuracyRate: number;
    self_correction_rate: number;
    learningGoal: string | null;
    goalContext: string | null;
    focusSkills: string[];
    learningTopics: string[];
    sessionIntensity: string | null;
    nativeLanguage: string;
    targetLanguage: string;
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
    action_plan: string | string[];
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

  const fetchDashboardData = useCallback(async () => {
    setData(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setData(prev => ({ ...prev, isLoading: false, error: 'Not authenticated' }));
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
            self_correction_rate,
            learning_goal,
            goal_context,
            focus_skills,
            learning_topics,
            session_intensity,
            native_language,
            target_language,
            full_name
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
              overall_level: profileData[DB_SCHEMA.COLUMNS.LEVEL] || 'A1',
              full_name: profileData.full_name || 'Learner',
              onboardingComplete: profileData[DB_SCHEMA.COLUMNS.ONBOARDING] || false,
              points: profileData[DB_SCHEMA.COLUMNS.POINTS] || 0,
              streak: profileData.streak || 0,
              pacingScore: profileData.pacing_score || 0,
              accuracyRate: profileData.accuracy_rate || 0,
              self_correction_rate: profileData.self_correction_rate || 0,
              learningGoal: profileData.learning_goal || null,
              goalContext: profileData.goal_context || null,
              focusSkills: profileData.focus_skills || [],
              learningTopics: profileData.learning_topics || [],
              sessionIntensity: profileData.session_intensity || null,
              nativeLanguage: profileData.native_language || 'English',
              targetLanguage: profileData.target_language || 'English',
            }
          : null,
        skills: (skillsData || []).map((s: any) => {
          const mScore = s[DB_SCHEMA.COLUMNS.SKILL_SCORE] ? (s[DB_SCHEMA.COLUMNS.SKILL_SCORE] / 100) : ((s.confidence || 0) * 100);
          const sName = s.skill || 'Unknown';
          return {
            skill: sName,
            skillId: sName,
            subject: sName,
            currentLevel: s.current_level || s.level || 'A1',
            overallLevel: s.current_level || s.level || 'A1',
            confidence: typeof s.confidence === 'number' ? s.confidence : ((s[DB_SCHEMA.COLUMNS.SKILL_SCORE] || 0) / 10000),
            masteryScore: mScore,
            status: mScore > 70 ? 'stable' : 'improving',
            evidenceCount: 5,
          };
        }),
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
              action_plan: (errorsRes.data as any).action_plan || "",
              bridge_delta: (errorsRes.data as any).bridge_delta,
              bridge_percentage: (errorsRes.data as any).bridge_percentage,
            }
          : { weakness_areas: [], common_mistakes: [], action_plan: "" },
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
    } catch (err: any) {
      console.error('[useSupabaseDashboard] Fetch error:', err);
      setData(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Controlled fetch wrapper to respect isMounted
    const safeFetch = () => {
        if (isMounted) fetchDashboardData();
    };

    safeFetch();

    // 🚀 VERCEL & AI REALTIME FIX: Listen for background Syncs / AI completing!
    let channel: any = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user || !isMounted) return;
        channel = supabase
            .channel('dashboard-sync')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'learner_profiles', filter: `id=eq.${user.id}` }, 
                () => isMounted && fetchDashboardData()
            )
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'user_error_analysis', filter: `user_id=eq.${user.id}` }, 
                () => isMounted && fetchDashboardData()
            )
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'user_error_profiles', filter: `user_id=eq.${user.id}` }, 
                () => isMounted && fetchDashboardData()
            )
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'learning_journeys', filter: `user_id=eq.${user.id}` }, 
                () => safeFetch()
            )
            .subscribe();
    });

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refreshTrigger, fetchDashboardData]);

  return { ...data, refresh: fetchDashboardData };
};

