import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';

// Context
import { DataProvider, useData } from './context/DataContext';
import { supabase } from './lib/supabaseClient';

// Views
import { AuthView } from './views/AuthView';
import { OnboardingView } from './views/OnboardingView';
import { PlacementOnboarding } from './components/onboarding/PlacementOnboarding';
import { DiagnosticView } from './views/DiagnosticView';
import { LandingView } from './views/LandingView';
import { LearningJourneyView } from './views/LearningJourneyView';
import { FadeTransition } from './lib/animations';
import { DashboardService } from './services/DashboardService';
import { useMemo } from 'react';

import { AdminDashboardView } from './views/AdminDashboardView';
import { AdminLeaderboardView } from './views/AdminLeaderboardView';
import { UserLeaderboardView } from './views/UserLeaderboardView';

// Components
import { AssessmentReviewView } from './views/AssessmentReviewView';
import { LearnerProfileView } from './views/LearnerProfileView';
import { ResultAnalysisView } from './views/ResultAnalysisView';
import { AdvancedDashboard } from './components/dashboard/AdvancedDashboard';
import { SharedRuntime } from './components/runtime/SharedRuntime';

// Dev Mode overlay
import { motion } from 'motion/react';
import { Code, X, Loader2 } from 'lucide-react';

const DevModeOverlay = ({ result, show, onClose }: { result: any; show: boolean; onClose: () => void }) => (
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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isInitializing, profile } = useData();
  const location = window.location.pathname;

  if (isInitializing) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  // 🛡️ REDIRECT HARDENING: Prioritize local cache during save windows to prevent background-sync-induced loops
  const hasCompletedAssessmentCache = localStorage.getItem('has_completed_assessment') === 'true';
  const isOnboardingCompleteCache = localStorage.getItem('onboarding_complete') === 'true';
  
  const hasCompletedAssessment = profile?.has_completed_assessment === true || hasCompletedAssessmentCache;
  const isOnboardingComplete = profile?.onboarding_complete === true || isOnboardingCompleteCache;
  const hasStartedOnboarding = !!profile?.learning_goal; // Check if they've at least done the setup
  
  // If we haven't finished onboarding or assessment, we MUST be at an onboarding/diagnostic route
  if (!isOnboardingComplete && !hasCompletedAssessment) {
    const isAtAssessment = location.includes('diagnostic') || location.includes('onboarding') || location.includes('results');
    
    // If they finished the setup (step 3) but not the assessment, let them stay in diagnostic
    if (hasStartedOnboarding && location.includes('diagnostic')) {
      return <>{children}</>;
    }

    if (!isAtAssessment) {
      console.warn('[ProtectedRoute] 🔂 Redirecting to onboarding (Incomplete Profile)');
      return <Navigate to="/onboarding" />;
    }
  }

  // Block access to onboarding or diagnostic if assessment is already complete
  if (hasCompletedAssessment || isOnboardingComplete) {
    const isResetting = location.includes('reset=true');
    if (!isResetting && (location === '/onboarding' || location === '/diagnostic' || location === '/diagnostic/intro')) {
      console.log('[ProtectedRoute] ✅ Blocked redundant onboarding access (Redirecting to Dashboard)');
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isInitializing, profile } = useData();
  
  if (isInitializing) return <LoadingScreen />;
  
  if (user) {
    const hasCompletedAssessmentCache = localStorage.getItem('has_completed_assessment') === 'true';
    const hasCompletedAssessment = profile?.has_completed_assessment === true || hasCompletedAssessmentCache;

    if (hasCompletedAssessment) return <Navigate to="/dashboard" replace />;
    if (profile?.onboarding_complete === true || !!profile?.learning_goal) return <Navigate to="/diagnostic/intro" replace />;
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
};

const LoadingScreen = () => (
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

function AppRoutes() {
  const navigate = useNavigate();
  const { 
    user, assessmentResult, assessmentOutcome, taskResults, 
    onboardingState, setSessionResult, setOnboarding,
    isArchitecting, logout, refreshData, devModeActive, clearAllData,
    updateProfileLocally
  } = useData() as any;

  React.useEffect(() => {
    if (user) {
      // ⚡ LIGHTNING AUTH: Warm up the session cache early
      (async () => {
        const { AssessmentSaveService } = await import('./services/AssessmentSaveService');
        await AssessmentSaveService.warmupAuth();
        
        // 🔄 Session Persistence Check
        if (!localStorage.getItem('has_completed_assessment')) {
          try {
            const remoteState = await AssessmentSaveService.getLatestAssessmentState(user.id);
            if (remoteState && remoteState.battery && remoteState.currentIndex > 0 && remoteState.currentIndex < remoteState.battery.length) {
              console.log('[App] 🔄 Found active remote session, resuming at question:', remoteState.currentIndex);
              // Save to local storage for engine to pick up
              localStorage.setItem(`asmt_state_${user.id}`, JSON.stringify(remoteState));
              if (!window.location.pathname.includes('/diagnostic')) {
                navigate('/diagnostic');
              }
            }
          } catch(err) {
            console.error('[App] Failed to check for active sessions:', err);
          }
        }
      })();
    }
  }, [user, navigate]);


  const handleLogout = async () => {
    try {
      console.log('[App] Initiating robust logout sequence...');
      await supabase.auth.signOut();
      clearAllData();
      localStorage.clear();
      sessionStorage.clear();
      
      // Force hard redirect to landing/auth to strictly clear all in-memory states
      window.location.href = '/auth';
    } catch (err) {
      console.error('[App] Logout failed:', err);
      window.location.href = '/auth';
    }
  };

  const dashboardData = useMemo(() => DashboardService.buildPayload(assessmentResult), [assessmentResult]);

  const handleAssessmentSave = async (history: any, outcome: any, evaluations: any) => {
    // ⚡ LIGHTNING RELEASE V2: Instant Hydration & Redirect
    const { AssessmentAnalysisService } = await import('./services/AnalysisService');
    
    // 1. Calculate local academic result immediately
    const computedSessionResult = AssessmentAnalysisService.fromAssessmentOutcome(
      outcome,
      user?.id || 'learner_temp_session',
      outcome?.assessmentId || 'diagnostic_session',
    );

    // 2. OPTIMISTIC HYDRATION: Update Context immediately so Results view has data
    setSessionResult(computedSessionResult, outcome, history);

    // 3. INSTANT REDIRECT
    console.log('[App] 🚀 Lightning Redirect to Results View...');
    navigate('/diagnostic/results', { replace: true });

    // Delay the flag setting to avoid ProtectedRoute hijack while still on /diagnostic
    setTimeout(() => {
      console.log('[App] 💧 Optimistically setting completion flags...');
      localStorage.setItem('has_completed_assessment', 'true'); // Fast cache for routing
      localStorage.setItem('onboarding_complete', 'true');
      updateProfileLocally({
          onboarding_complete: true,
          has_completed_assessment: true,
          overall_level: outcome.overallBand || 'A1',
          accuracy_rate: outcome.accuracyRate ?? 0,
          pacing_score: outcome.pacingScore ?? 0,
          average_response_time: outcome.averageResponseTimeMs ?? 0,
          total_questions_answered: outcome.totalQuestionsAnswered ?? 0,
      });
    }, 100);

    // 4. BACKGROUND ORCHESTRATION (The "Heavy" work)
    // We execute this in an async closure to prevent blocking the UI
    (async () => {
      try {
        console.log('[App] 🧵 Background worker started...');
        const { AssessmentSaveService } = await import('./services/AssessmentSaveService');
        
        // Ensure auth is warm in this context
        await AssessmentSaveService.warmupAuth();
        
        console.log('[App] ☁️ Triggering Deep Cloud Analysis...');
        const deepAnalysis = await AssessmentSaveService.analyzeAssessmentRemote(history).catch(e => {
            console.warn("[App] Cloud analysis failed. Reason:", e.message);
            return null;
        });

        console.log('[App] 🏗️ Persisting comprehensive data to 5 tables...');
        await AssessmentSaveService.saveAssessmentComprehensive({
          userId: user?.id,
          history,
          outcome: { ...outcome, aiAnalysis: deepAnalysis },
          evaluations
        });

        // 🔄 Sync local profile with DB updates
        await refreshData();
        
        // 🗺️ ARCHITECTURE: Generate Journey in Background so results view is ready
        try {
          console.log('[App] 🗺️ Architecting personalized journey in background...');
          const { JourneyService } = await import('./services/JourneyService');
          const sessionResultString = localStorage.getItem(`asmt_result_${user?.id}`);
          const sessionResult = sessionResultString ? JSON.parse(sessionResultString) : computedSessionResult;
          
          const dynamicJourney = await JourneyService.generateDynamicJourney(sessionResult);
          await JourneyService.persistJourney(dynamicJourney, user.id);
          console.log('[App] ✅ Background Journey established.');
        } catch (journeyErr) {
          console.warn('[App] ⚠️ Background Journey creation failed:', journeyErr);
        }

        console.log('[App] ✅ Background Sync Complete. Ecosystem Hydrated.');
      } catch (err) {
        console.error('[App] ❌ Background worker failed:', err);
      }
    })();
  };

  return (
    <div className="font-sans antialiased text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900 bg-slate-50 min-h-screen">
      <DevModeOverlay result={assessmentResult} show={devModeActive} onClose={() => {}} />

      <AnimatePresence mode="wait">
        <Routes>
          {/* Landing */}
          <Route path="/" element={<LandingView onGetStarted={() => navigate('/auth')} onSignIn={() => navigate('/auth')} />} />

          {/* Auth */}
          <Route path="/auth" element={
            <PublicRoute>
              <AuthView 
                role="user" 
                onBack={() => navigate('/')} 
                onLogin={(role: string, onboardingComplete: boolean) => {
                  if (onboardingComplete) navigate('/dashboard');
                  else navigate('/onboarding');
                }} 
              />
            </PublicRoute>
          } />

          {/* Onboarding */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingView onComplete={(state: any) => { setOnboarding(state); navigate('/diagnostic/intro'); }} />
            </ProtectedRoute>
          } />

          {/* Diagnostic */}
          <Route path="/diagnostic/intro" element={
            <ProtectedRoute>
              <PlacementOnboarding />
            </ProtectedRoute>
          } />

          <Route path="/diagnostic" element={
            <ProtectedRoute>
              <DiagnosticView 
                onboardingState={onboardingState}
                taskResults={taskResults}
                onSaveComplete={handleAssessmentSave}
              />
            </ProtectedRoute>
          } />

          {/* Results Analysis View */}
          <Route path="/diagnostic/results" element={
            <ProtectedRoute>
              {assessmentResult ? (
                <ResultAnalysisView 
                  result={assessmentResult}
                  assessmentOutcome={assessmentOutcome}
                  isArchitecting={isArchitecting}
                  onContinue={() => window.location.assign('/dashboard')}
                  onReview={() => navigate('/review/latest')}
                />
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            </ProtectedRoute>
          } />

          {/* Dashboard & Tabs (Nested handles in AdvancedDashboard) */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <AdvancedDashboard
                result={assessmentResult}
                dashboardData={dashboardData}
                assessmentOutcome={assessmentOutcome}
                onStartSession={() => navigate('/runtime')}
                onNavigateLeaderboard={() => navigate('/leaderboard')}
                onViewReview={() => navigate(`/review/latest`)}
                onViewHistoryReport={(id: string) => navigate(`/review/${id}`)}
                onLogout={handleLogout}
                isArchitecting={isArchitecting}
              />
            </ProtectedRoute>
          } />

          {/* Standalone Learning Journey */}
          <Route path="/journey" element={
            <ProtectedRoute>
              <LearningJourneyView 
                result={assessmentResult} 
                onStartSession={() => navigate('/runtime')} 
                onViewDashboard={() => navigate('/dashboard')} 
              />
            </ProtectedRoute>
          } />

          {/* Legacy redirect for old links */}
          <Route path="/learning-journey" element={<Navigate to="/journey" replace />} />

          {/* Analytics, Practice, Review, History - All are tabs in Dashboard */}
          <Route path="/analytics" element={<Navigate to="/dashboard/analytics" />} />
          <Route path="/practice" element={<Navigate to="/dashboard/hub" />} />
          <Route path="/review" element={<Navigate to="/dashboard/review" />} />
          <Route path="/history" element={<Navigate to="/dashboard/history" />} />

          {/* Review Deep Dive */}
          <Route path="/review/:sessionId" element={
            <ProtectedRoute>
              <AssessmentReviewView 
                evaluations={taskResults}
                assessmentId={window.location.pathname.split('/').pop()}
                onBack={() => navigate(-1)}
              />
            </ProtectedRoute>
          } />

          {/* Leaderboard */}
          <Route path="/leaderboard" element={
            <ProtectedRoute>
              <UserLeaderboardView onBack={() => navigate(-1)} currentUserId={user?.id || 'u3'} />
            </ProtectedRoute>
          } />

          {/* Learning Loop (Runtime) */}
          <Route path="/runtime" element={
            <ProtectedRoute>
              <SharedRuntime result={assessmentResult} onExit={() => navigate('/dashboard')} />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboardView 
                onNavigateLeaderboard={() => {}} 
                onNavigateHome={() => {}}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          } />

          {/* Intelligence Profile */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <LearnerProfileView />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </DataProvider>
  );
}
