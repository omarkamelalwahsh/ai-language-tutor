import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AssessmentSessionResult, AssessmentOutcome, TaskEvaluation } from '../types/assessment';
import { OnboardingState } from '../types/app';
import { DashboardService } from '../services/DashboardService';

interface DataContextType {
  user: any | null;
  profile: any | null;
  assessmentResult: AssessmentSessionResult | null;
  assessmentOutcome: AssessmentOutcome | null;
  taskResults: TaskEvaluation[];
  onboardingState: OnboardingState | null;
  isInitializing: boolean;
  isArchitecting: boolean;
  refreshTrigger: number;
  refreshData: () => Promise<void>;
  setSessionResult: (result: AssessmentSessionResult, outcome: AssessmentOutcome, evals: TaskEvaluation[]) => void;
  setOnboarding: (state: OnboardingState) => void;
  logout: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentSessionResult | null>(null);
  const [assessmentOutcome, setAssessmentOutcome] = useState<AssessmentOutcome | null>(null);
  const [taskResults, setTaskResults] = useState<TaskEvaluation[]>([]);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const dataLoadedRef = useRef(false);

  const loadLocalState = useCallback(() => {
    const loadSafe = (key: string, setter: (val: any) => void) => {
      const data = localStorage.getItem(key);
      if (data && data !== 'undefined') {
        try { setter(JSON.parse(data)); } catch (err) { localStorage.removeItem(key); }
      }
    };
    loadSafe('last_assessment_result', setAssessmentResult);
    loadSafe('last_assessment_outcome', setAssessmentOutcome);
    loadSafe('last_assessment_evals', setTaskResults);
    loadSafe('onboarding_state', setOnboardingState);
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(authUser);

      // Fetch Profile
      const { data: profileData } = await supabase
        .from('learner_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      setProfile(profileData);
      // Trigger global refresh for dashboard components
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('[DataContext] Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    loadLocalState();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      localStorage.setItem('auth_token', session.access_token);
      localStorage.setItem('auth_user_id', session.user.id);
      await refreshData();
    }
    
    setIsInitializing(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        localStorage.setItem('auth_token', session.access_token);
        localStorage.setItem('auth_user_id', session.user.id);
        await refreshData();
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user_id');
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadLocalState, refreshData]);

  // Restored strict useEffect with dataLoadedRef safeguard
  useEffect(() => {
    if (dataLoadedRef.current) return;
    
    const runInit = async () => {
      try {
        await initialize();
        dataLoadedRef.current = true;
      } catch (err) {
        console.error('[DataContext] Initialization failed:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    runInit();
    // Only re-run if the user identity changes
  }, [user?.id, initialize]);

  const setSessionResult = (result: AssessmentSessionResult, outcome: AssessmentOutcome, evals: TaskEvaluation[]) => {
    setAssessmentResult(result);
    setAssessmentOutcome(outcome);
    setTaskResults(evals);
    
    localStorage.setItem('last_assessment_result', JSON.stringify(result));
    localStorage.setItem('last_assessment_outcome', JSON.stringify(outcome));
    localStorage.setItem('last_assessment_evals', JSON.stringify(evals));
  };

  const setOnboarding = (state: OnboardingState) => {
    setOnboardingState(state);
    localStorage.setItem('onboarding_state', JSON.stringify(state));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setUser(null);
    setProfile(null);
    setAssessmentResult(null);
    setAssessmentOutcome(null);
    setTaskResults([]);
    setOnboardingState(null);
  };

  // Dynamic Journey Generation Trigger (moved from App.tsx)
  useEffect(() => {
    if (assessmentResult && !isArchitecting) {
      const triggerDynamicJourney = async () => {
        setIsArchitecting(true);
        try {
          const { JourneyService } = await import('../services/JourneyService');
          const dynamicJourney = await JourneyService.generateDynamicJourney(assessmentResult);
          
          // We could store journey in state too if needed, 
          // but usually it's derived in dashboardData or fetched.
        } catch (err) {
          console.error('[DataContext] Failed to architect dynamic journey:', err);
        } finally {
          setIsArchitecting(false);
        }
      };
      triggerDynamicJourney();
    }
  }, [assessmentResult, isArchitecting]);

  return (
    <DataContext.Provider value={{ 
      user, profile, assessmentResult, assessmentOutcome, taskResults, 
      onboardingState, isInitializing, isArchitecting, refreshTrigger,
      refreshData, setSessionResult, setOnboarding, logout 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
