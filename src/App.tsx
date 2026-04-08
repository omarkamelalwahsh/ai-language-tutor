import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { OnboardingState, ViewState } from './types/app';
import { AssessmentSessionResult, AssessmentOutcome, TaskEvaluation } from './types/assessment';
import { DashboardService } from './services/DashboardService';
import { AssessmentAnalysisService } from './services/AnalysisService';
import { supabase } from './lib/supabaseClient';

// Views
import { AuthView } from './views/AuthView';
import { OnboardingView } from './views/OnboardingView';
import { PreAssessmentIntroView } from './views/PreAssessmentIntroView';
import { DiagnosticView } from './views/DiagnosticView';
import { AnalyzingView } from './views/AnalyzingView';
import { LandingView } from './views/LandingView';
import { FadeTransition } from './lib/animations';

import { AdminDashboardView } from './views/AdminDashboardView';
import { AdminLeaderboardView } from './views/AdminLeaderboardView';
import { UserLeaderboardView } from './views/UserLeaderboardView';

// Components
import { ResultAnalysisView } from './views/ResultAnalysisView';
import { AssessmentReviewView } from './views/AssessmentReviewView';
import { LearningJourneyView } from './views/LearningJourneyView';
import { AdvancedDashboard } from './components/dashboard/AdvancedDashboard';
import { SharedRuntime } from './components/runtime/SharedRuntime';

// Dev Mode overlay
import { motion } from 'motion/react';
import { Code, X, Loader2 } from 'lucide-react';

const DevModeOverlay = ({ result, show, onClose }: { result: AssessmentSessionResult | null; show: boolean; onClose: () => void }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end"
      >
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-md h-full bg-slate-50 border-l border-slate-200 shadow-2xl flex flex-col pt-6"
        >
          <div className="flex justify-between items-center px-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-indigo-600">
              <Code className="w-5 h-5" />
              <h3 className="font-mono font-bold">Data Capture JSON</h3>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-200 rounded-full text-slate-500 hover:text-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 font-mono text-xs sm:text-sm text-slate-700">
            <pre>{JSON.stringify({ assessmentResult: result }, null, 2)}</pre>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [taskResults, setTaskResults] = useState<TaskEvaluation[]>([]);
  const [assessmentOutcome, setAssessmentOutcome] = useState<AssessmentOutcome | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentSessionResult | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [devModeActive, setDevModeActive] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // 💾 Initialization: Check Auth & Profile on mount
  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Check current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session) {
          console.log('[App] Session found for:', session.user.email);
          localStorage.setItem('auth_token', session.access_token);
          localStorage.setItem('auth_user_id', session.user.id);

          // 2. Fetch User Profile to check onboarding status
          const { data: profile, error: profileError } = await supabase
            .from('learner_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "no rows found"
            console.warn('[App] Profile fetch error:', profileError);
          }

          if (profile) {
            console.log('[App] Profile found. Onboarding complete:', profile.onboarding_complete);
            if (profile.onboarding_complete) {
              navigateTo('DASHBOARD');
            } else if (profile.last_path === '/diagnostic' || profile.last_path === 'DIAGNOSTIC') {
              navigateTo('DIAGNOSTIC');
            } else {
               navigateTo('ONBOARDING');
            }
          } else {
            // Logged in but no profile record yet
            navigateTo('ONBOARDING');
          }
        } else {
          console.log('[App] No session found.');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user_id');
        }
      } catch (err) {
        console.error('[App] Initialization error:', err);
      } finally {
        setInitializing(false);
      }
    };

    // Load from localStorage as fallback/cache for existing session logic
    const loadSafe = (key: string, setter: (val: any) => void) => {
      const data = localStorage.getItem(key);
      if (data && data !== 'undefined') {
        try {
          setter(JSON.parse(data));
        } catch (err) {
          console.error(`[App] Corrupted ${key} detected, clearing...`, err);
          localStorage.removeItem(key);
        }
      }
    };

    loadSafe('last_assessment_result', setAssessmentResult);
    loadSafe('last_assessment_outcome', setAssessmentOutcome);
    loadSafe('last_assessment_evals', setTaskResults);

    initializeApp();

    // Supabase Auth Listener for subsequent changes (login/logout from other tabs or actions)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App] Auth event:', event);
      if (session) {
        localStorage.setItem('auth_token', session.access_token);
        localStorage.setItem('auth_user_id', session.user.id);
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user_id');
        // If we log out, ensure we return to landing
        navigateTo('LANDING');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 💾 State Persistence: Save to localStorage when state changes
  React.useEffect(() => {
    if (assessmentResult) {
      localStorage.setItem('last_assessment_result', JSON.stringify(assessmentResult));
      localStorage.setItem('last_assessment_outcome', JSON.stringify(assessmentOutcome));
      localStorage.setItem('last_assessment_evals', JSON.stringify(taskResults));
      
      // Initialize Dashboard Data if not already set
      if (!dashboardData) {
        setDashboardData(DashboardService.buildPayload(assessmentResult));
      }
    }
  }, [assessmentResult, assessmentOutcome, taskResults, dashboardData]);

  // Handle Dynamic Journey Generation
  React.useEffect(() => {
    if (assessmentResult && !isArchitecting) {
      const triggerDynamicJourney = async () => {
        setIsArchitecting(true);
        try {
          const { JourneyService } = await import('./services/JourneyService');
          const dynamicJourney = await JourneyService.generateDynamicJourney(assessmentResult);
          
          setDashboardData((prev: any) => ({
            ...prev,
            journey: dynamicJourney
          }));
        } catch (err) {
          console.error('[App] Failed to architect dynamic journey:', err);
        } finally {
          setIsArchitecting(false);
        }
      };
      
      triggerDynamicJourney();
    }
  }, [assessmentResult]);

  // ☁️ Cloud Sync: Fetch History from Supabase if missing
  React.useEffect(() => {
    const userId = localStorage.getItem('auth_user_id');
    const token = localStorage.getItem('auth_token');

    if (userId && token && !assessmentResult && (view === 'DASHBOARD' || view === 'AUTH' || view === 'ONBOARDING')) {
      const fetchHistory = async () => {
        try {
          const res = await fetch(`/api/user/history/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!res.ok) return;

          const data = await res.json();
          const { history } = data;

          if (history && history.length > 0) {
            console.log(`[App] ${history.length} cloud responses found. Reaffirming state...`);
            
            // Map logs to TaskEvaluation/AnswerRecord for resumption
            const mappedHistory = history.map((h: any) => ({
              taskId: h.task_id || h.id,
              skill: h.category,
              primarySkill: h.category,
              correct: h.is_correct,
              answer: h.user_answer,
              correctAnswer: h.correct_answer,
              score: h.is_correct ? 1 : 0,
              channels: { comprehension: h.is_correct ? 1 : 0 },
              errorTag: h.error_tag,
              briefExplanation: h.brief_explanation
            }));

            // If user has history but we are in AUTH or ONBOARDING, they might need to RESUME
            // LOGIC: If they have less than e.g. 20 answers, they are probably still in the diagnostic
            if (history.length < 20) {
               console.log('[App] Partial history detected. Suggesting resume...');
               setTaskResults(mappedHistory);
               // We don't build a full AssessmentResult yet for partial sessions
               if (view === 'AUTH' || view === 'ONBOARDING' || view === 'LANDING') {
                 navigateTo('DIAGNOSTIC');
               }
               return;
            }

            const latest = history[0];
            const reconstructed: AssessmentSessionResult = {
              learnerId: userId,
              sessionId: latest.assessment_id || 'restored-session',
              generatedAt: latest.created_at,
              overall: {
                estimatedLevel: (latest.answer_level || 'B1') as any,
                confidence: 0.8,
                rationale: ["Restored from your previous progress."]
              },
              behavioralProfile: { pace: "moderate", confidenceStyle: "balanced", selfCorrectionRate: 0.5 },
              metadata: { assessmentReason: "Resumed Session" },
              skills: {
                listening: { skill: 'listening', estimatedLevel: (latest.answer_level || 'B1') as any, confidence: { band: 'medium', score: 0.5, reasons: [] }, evidenceCount: 1, descriptors: [], strengths: [], weaknesses: [], taskCoverage: { total: 1, completed: 1, valid: 1 }, subscores: [], status: 'provisional' },
                reading: { skill: 'reading', estimatedLevel: (latest.answer_level || 'B1') as any, confidence: { band: 'medium', score: 0.5, reasons: [] }, evidenceCount: 1, descriptors: [], strengths: [], weaknesses: [], taskCoverage: { total: 1, completed: 1, valid: 1 }, subscores: [], status: 'provisional' },
                writing: { skill: 'writing', estimatedLevel: (latest.answer_level || 'B1') as any, confidence: { band: 'medium', score: 0.5, reasons: [] }, evidenceCount: 1, descriptors: [], strengths: [], weaknesses: [], taskCoverage: { total: 1, completed: 1, valid: 1 }, subscores: [], status: 'provisional' },
                speaking: { skill: 'speaking', estimatedLevel: (latest.answer_level || 'B1') as any, confidence: { band: 'medium', score: 0.5, reasons: [] }, evidenceCount: 1, descriptors: [], strengths: [], weaknesses: [], taskCoverage: { total: 1, completed: 1, valid: 1 }, subscores: [], status: 'provisional' },
                vocabulary: { skill: 'vocabulary', estimatedLevel: (latest.answer_level || 'B1') as any, confidence: { band: 'medium', score: 0.5, reasons: [] }, evidenceCount: 1, descriptors: [], strengths: [], weaknesses: [], taskCoverage: { total: 1, completed: 1, valid: 1 }, subscores: [], status: 'provisional' },
                grammar: { skill: 'grammar', estimatedLevel: (latest.answer_level || 'B1') as any, confidence: { band: 'medium', score: 0.5, reasons: [] }, evidenceCount: 1, descriptors: [], strengths: [], weaknesses: [], taskCoverage: { total: 1, completed: 1, valid: 1 }, subscores: [], status: 'provisional' }
              },
              recommendedNextTasks: ["Continue Assessment"]
            };

            setAssessmentResult(reconstructed);
            
            // LOGIC: If they have less than e.g. 5 answers, they are probably still in the diagnostic
            if (history.length < 20 && view === 'AUTH') {
              console.log('[App] Partial history detected. Suggesting resume...');
              navigateTo('DIAGNOSTIC');
            }
          }
        } catch (err) {
          console.error('[App] Cloud history sync quietly failed (Vercel might not be updated yet):', err);
        }
      };
      fetchHistory();
    }
  }, [view]); 


  const navigateTo = (newView: ViewState) => {
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 animate-pulse">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Restoring Your Session</h2>
            <p className="text-slate-500 text-sm font-medium">Please wait while we prepare your workspace...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900 bg-slate-50 min-h-screen">
      <DevModeOverlay result={assessmentResult} show={devModeActive} onClose={() => setDevModeActive(false)} />

      <AnimatePresence mode="wait">
        {/* Landing replaces Role Selection as entry point */}
        {view === 'LANDING' && (
          <LandingView 
            key="landing" 
            onGetStarted={() => {
              setUserRole('user');
              navigateTo('AUTH');
            }} 
            onSignIn={() => {
              setUserRole('user');
              navigateTo('AUTH');
            }} 
          />
        )}

        {view === 'AUTH' && (
          <AuthView 
            role={userRole}
            onBack={() => navigateTo('LANDING')}
            onLogin={(role, onboardingComplete) => {
              if (role === 'admin') {
                navigateTo('ADMIN_DASHBOARD');
              } else if (onboardingComplete) {
                navigateTo('DASHBOARD');
              } else {
                navigateTo('ONBOARDING');
              }
            }} 
          />
        )}

        {view === 'ONBOARDING' && (
          <OnboardingView key="onboarding" onComplete={(state) => {
            setOnboardingState(state);
            navigateTo('PRE_ASSESSMENT_INTRO');
          }} />
        )}

        {view === 'PRE_ASSESSMENT_INTRO' && (
          <PreAssessmentIntroView
            key="pre-assessment-intro"
            onStartAssessment={() => navigateTo('DIAGNOSTIC')}
            onBack={() => navigateTo('ONBOARDING')}
          />
        )}

        {view === 'DIAGNOSTIC' && (
          <DiagnosticView 
            key="diagnostic" 
            onboardingState={onboardingState}
            taskResults={taskResults}
            onSaveComplete={(results, outcome) => {
              // Sync state for Assessment Review & legacy screens
              setTaskResults(results);
              setAssessmentOutcome(outcome);

              // Build assessmentResult immediately from the outcome (no async state lag)
              const userId = localStorage.getItem('auth_user_id') || 'user_1';
              const result = AssessmentAnalysisService.fromAssessmentOutcome(
                outcome,
                userId,
                'session_' + Date.now(),
                onboardingState || {}
              );
              setAssessmentResult(result);
              setDashboardData(DashboardService.buildPayload(result));

              // Skip ANALYZING → RESULT_ANALYSIS → LEARNING_JOURNEY, go straight to Dashboard
              navigateTo('DASHBOARD');
            }}
          />
        )}

        {view === 'ANALYZING' && (
          <AnalyzingView
            key="analyzing"
            onboardingState={onboardingState}
            taskResults={taskResults}
            assessmentOutcome={assessmentOutcome}
            onComplete={(result) => {
              setAssessmentResult(result);
              navigateTo('RESULT_ANALYSIS');
            }}
          />
        )}

        {view === 'RESULT_ANALYSIS' && assessmentResult && (
          <ResultAnalysisView
            key="result_analysis"
            result={assessmentResult}
            assessmentOutcome={assessmentOutcome}
            onContinue={() => navigateTo('LEARNING_JOURNEY')}
            onReview={() => navigateTo('ASSESSMENT_REVIEW')}
          />
        )}

        {view === 'ASSESSMENT_REVIEW' && (
          <AssessmentReviewView
            key="assessment_review"
            evaluations={taskResults}
            assessmentId={selectedHistoryId || assessmentResult?.sessionId}
            onBack={() => {
              setSelectedHistoryId(null);
              navigateTo(selectedHistoryId ? 'DASHBOARD' : 'RESULT_ANALYSIS');
            }}
          />
        )}

        {view === 'LEARNING_JOURNEY' && assessmentResult && (
          <LearningJourneyView
            key="learning_journey"
            result={assessmentResult}
            onStartSession={() => navigateTo('LEARNING_LOOP')}
            onViewDashboard={() => navigateTo('DASHBOARD')}
          />
        )}

        {view === 'DASHBOARD' && (
          <FadeTransition key="dashboard" className="min-h-screen bg-slate-50">
            <AdvancedDashboard
              result={assessmentResult}
              dashboardData={dashboardData || DashboardService.buildPayload(assessmentResult)}
              assessmentOutcome={assessmentOutcome}
              onStartSession={() => navigateTo('LEARNING_LOOP')}
              onNavigateLeaderboard={() => navigateTo('USER_LEADERBOARD')}
              onViewReview={() => navigateTo('ASSESSMENT_REVIEW')}
              onViewHistoryReport={(id) => {
                setSelectedHistoryId(id);
                navigateTo('ASSESSMENT_REVIEW');
              }}
              onLogout={async () => {
                await supabase.auth.signOut();
                localStorage.clear();
                setAssessmentResult(null);
                setAssessmentOutcome(null);
                setTaskResults([]);
                setDashboardData(null);
                navigateTo('LANDING');
              }}
              isArchitecting={isArchitecting}
            />
          </FadeTransition>
        )}

        {view === 'ADMIN_DASHBOARD' && userRole === 'admin' && (
          <AdminDashboardView 
            key="admin_dashboard" 
            onNavigateLeaderboard={() => navigateTo('ADMIN_LEADERBOARD')} 
            onNavigateHome={() => navigateTo('LANDING')}
            onLogout={() => navigateTo('AUTH')}
          />
        )}

        {view === 'ADMIN_LEADERBOARD' && userRole === 'admin' && (
          <AdminLeaderboardView 
            key="admin_leaderboard" 
            onNavigateDashboard={() => navigateTo('ADMIN_DASHBOARD')}
            onNavigateHome={() => navigateTo('LANDING')}
            onLogout={() => navigateTo('AUTH')}
          />
        )}

        {view === 'USER_LEADERBOARD' && (
          <UserLeaderboardView 
            key="user_leaderboard" 
            onBack={() => navigateTo('DASHBOARD')}
            currentUserId="u3"
          />
        )}

        {view === 'LEARNING_LOOP' && assessmentResult && (
          <SharedRuntime key="learning_loop" result={assessmentResult} onExit={() => navigateTo('DASHBOARD')} />
        )}
      </AnimatePresence>
    </div>
  );
}
