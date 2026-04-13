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
  updateProfileLocally: (updates: any) => void;
  setSessionResult: (result: AssessmentSessionResult, outcome: AssessmentOutcome, evals: TaskEvaluation[]) => void;
  setOnboarding: (state: OnboardingState) => void;
  logout: () => Promise<void>;
  clearAllData: () => void;
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

      // ONBOARDING GUARD: Allow profile sync even on onboarding paths to prevent redirect traps
      const isOnboarding = window.location.pathname.includes('/onboarding');

      // Fetch Profile
      const { data: profileData } = await supabase
        .from('learner_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        // Trigger global refresh for dashboard components
        setRefreshTrigger(prev => prev + 1);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('[DataContext] Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
      // Ensure we unblock the UI if finished checking
      setIsInitializing(false);
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
        
        if (event === 'SIGNED_IN') {
          console.log('[Auth] User signed in, initializing profile...');
        }

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

  const updateProfileLocally = (updates: any) => {
    setProfile((prev: any) => ({ ...prev, ...updates }));
    // Also update local storage to survive simple refreshes
    if (profile) {
      localStorage.setItem('cached_profile', JSON.stringify({ ...profile, ...updates }));
    }
  };

  const setOnboarding = (state: OnboardingState) => {
    setOnboardingState(state);
    localStorage.setItem('onboarding_state', JSON.stringify(state));
  };

  const clearAllData = useCallback(() => {
    console.log('[DataContext] Atomically clearing all local states...');
    setUser(null);
    setProfile(null);
    setAssessmentResult(null);
    setAssessmentOutcome(null);
    setTaskResults([]);
    setOnboardingState(null);
    setIsArchitecting(false);
  }, []);

  const logout = async () => {
    try {
      console.log('[DataContext] Initiating logout...');
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      
      // Reset all states
      clearAllData();
      
      console.log('[DataContext] Logout successful and state cleared.');
    } catch (err) {
      console.error('[DataContext] Logout failed:', err);
      // Fallback: clear local state anyway
      localStorage.clear();
      sessionStorage.clear();
      clearAllData();
      window.location.href = '/auth'; // Force hard redirect as fallback
    }
  };

  // Dynamic Journey Generation Trigger (moved from App.tsx)
  // 🔧 FIX: Use ref to ensure we only trigger once per assessmentResult
  const journeyGeneratedRef = useRef(false);
  useEffect(() => {
    if (assessmentResult && !isArchitecting && !journeyGeneratedRef.current) {
      journeyGeneratedRef.current = true;
      const triggerDynamicJourney = async () => {
        setIsArchitecting(true);
        try {
          const { JourneyService } = await import('../services/JourneyService');
          const dynamicJourney = await JourneyService.generateDynamicJourney(assessmentResult);
        } catch (err) {
          console.error('[DataContext] Failed to architect dynamic journey:', err);
        } finally {
          setIsArchitecting(false);
        }
      };
      triggerDynamicJourney();
    }
  }, [assessmentResult]); // ✅ Only re-run when assessmentResult changes, NOT isArchitecting

  return (
    <DataContext.Provider value={{ 
      user, profile, assessmentResult, assessmentOutcome, taskResults, 
      onboardingState, isInitializing, isArchitecting, refreshTrigger,
      refreshData, setSessionResult, setOnboarding, logout, clearAllData,
      updateProfileLocally
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
