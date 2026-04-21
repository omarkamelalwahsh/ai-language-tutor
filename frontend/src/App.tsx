import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

// Context
import { DataProvider, useData } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { supabase } from './lib/supabaseClient';

// Components
import { NeuralPulseLoader } from './components/common/NeuralPulseLoader';
import { PrestigeErrorBoundary } from './components/common/PrestigeErrorBoundary';
import ThemeToggle from './components/ThemeToggle';
import { DashboardService } from './services/DashboardService';
import { useMemo } from 'react';

// Icons
import { Code, X, ShieldCheck } from 'lucide-react';

// Views - Migrated to Lazy Loading
const AuthView = lazy(() => import('./views/AuthView'));
import LandingView from './views/LandingView';
const OnboardingView = lazy(() => import('./views/OnboardingView'));
const DiagnosticView = lazy(() => import('./views/DiagnosticView'));
const ResultAnalysisView = lazy(() => import('./views/ResultAnalysisView'));
const AdvancedDashboard = lazy(() => import('./components/dashboard/AdvancedDashboard'));
const AssessmentReviewView = lazy(() => import('./views/AssessmentReviewView'));
const LearningJourneyView = lazy(() => import('./views/LearningJourneyView'));
const SharedRuntime = lazy(() => import('./components/runtime/SharedRuntime'));
const AdminDashboardView = lazy(() => import('./views/AdminDashboardView'));
const UserLeaderboardView = lazy(() => import('./views/UserLeaderboardView'));
const LearnerProfileView = lazy(() => import('./views/LearnerProfileView'));

// Legacy redirect components
const PlacementOnboarding = lazy(() => import('./components/onboarding/PlacementOnboarding'));
const AdminLeaderboardView = lazy(() => import('./views/AdminLeaderboardView'));

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
          className="w-full max-w-md h-full bg-slate-50 border-l border-slate-200 shadow-sm dark:shadow-md flex flex-col pt-6"
        >
          <div className="flex justify-between items-center px-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
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

  if (isInitializing) return <NeuralPulseLoader status="Restoring Your AI Protocol..." />;
  if (!user) return <Navigate to="/auth" replace />;

  const hasCompletedAssessmentCache = localStorage.getItem('has_completed_assessment') === 'true';
  const isOnboardingCompleteCache = localStorage.getItem('onboarding_complete') === 'true';
  
  const hasCompletedAssessment = profile?.has_completed_assessment === true || hasCompletedAssessmentCache;
  const isOnboardingComplete = profile?.onboarding_complete === true || isOnboardingCompleteCache;
  const hasStartedOnboarding = !!profile?.learning_goal; 
  
  if (!isOnboardingComplete && !hasCompletedAssessment) {
    const isAtAssessment = location.includes('diagnostic') || location.includes('onboarding') || location.includes('results');
    
    if (hasStartedOnboarding && location.includes('diagnostic')) {
      return <>{children}</>;
    }

    if (!isAtAssessment) {
      console.warn('[ProtectedRoute] 🔂 Redirecting to onboarding');
      return <Navigate to="/onboarding" />;
    }
  }

  if (hasCompletedAssessment || isOnboardingComplete) {
    const isResetting = location.includes('reset=true');
    if (!isResetting && (location === '/onboarding' || location === '/diagnostic' || location === '/diagnostic/intro')) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isInitializing, profile } = useData();
  if (isInitializing) return <NeuralPulseLoader status="Authenticating Session..." />;
  
  if (user) {
    const hasCompletedAssessmentCache = localStorage.getItem('has_completed_assessment') === 'true';
    const hasCompletedAssessment = profile?.has_completed_assessment === true || hasCompletedAssessmentCache;

    if (hasCompletedAssessment) return <Navigate to="/dashboard" replace />;
    if (profile?.onboarding_complete === true || !!profile?.learning_goal) return <Navigate to="/diagnostic/intro" replace />;
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
};

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user, assessmentResult, assessmentOutcome, taskResults, 
    onboardingState, setSessionResult, setOnboarding,
    isArchitecting, logout, refreshData, clearAllData,
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
    const { AssessmentAnalysisService } = await import('./services/AnalysisService');
    
    // 1. Calculate local academic result immediately
    const computedSessionResult = AssessmentAnalysisService.fromAssessmentOutcome(
      outcome,
      user?.id || 'learner_temp_session',
      outcome?.assessmentId || 'diagnostic_session',
    );

    // 2. OPTIMISTIC HYDRATION: Update Context so Results view has data to display
    setSessionResult(computedSessionResult, outcome, history);

    // 3. INSTANT REDIRECT to results (we have data, so show it immediately)
    console.log('[App] 🚀 Redirecting to Results View...');
    navigate('/diagnostic/results', { replace: true });

    // ✅ CORRECT: Do NOT set completion flags here.
    // They are only set AFTER backend confirms 200 OK in the background worker below.

    // 4. BACKGROUND ORCHESTRATION - runs after redirect, does NOT block UI
    (async () => {
      try {
        console.log('[App] 🧵 Background worker started...');
        const { AssessmentSaveService } = await import('./services/AssessmentSaveService');
        await AssessmentSaveService.warmupAuth();
        
        const deepAnalysis = await AssessmentSaveService.analyzeAssessmentRemote(history).catch(e => {
            console.warn("[App] Cloud analysis failed:", e.message);
            return null;
        });

        console.log('[App] 🏗️ Persisting assessment data to backend...');
        await AssessmentSaveService.saveAssessmentComprehensive({
          userId: user?.id,
          history,
          outcome: { ...outcome, aiAnalysis: deepAnalysis },
          evaluations
        });

        // ✅ ONLY NOW - backend confirmed 200 OK - set the completion flags
        console.log('[App] ✅ Backend confirmed save. Setting completion flags NOW.');
        localStorage.setItem('has_completed_assessment', 'true');
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

        // 🔄 Sync local profile with DB updates
        await refreshData();
        
        // 🗺️ Generate Journey in background
        try {
          const { JourneyService } = await import('./services/JourneyService');
          const sessionResultString = localStorage.getItem(`asmt_result_${user?.id}`);
          const sessionResult = sessionResultString ? JSON.parse(sessionResultString) : computedSessionResult;
          const dynamicJourney = await JourneyService.generateDynamicJourney(sessionResult);
          await JourneyService.persistJourney(dynamicJourney, user.id);
          console.log('[App] ✅ Journey established.');
        } catch (journeyErr) {
          console.warn('[App] ⚠️ Journey creation failed:', journeyErr);
        }

        console.log('[App] ✅ Background Sync Complete.');
      } catch (err) {
        console.error('[App] ❌ Background worker failed:', err);
      }
    })();
  };

  return (
    <div className="bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 min-h-screen w-full selection:bg-cyan-500/30 overflow-x-hidden relative transition-colors duration-300">
      <PrestigeErrorBoundary key="main-error-boundary">
        <Suspense fallback={<NeuralPulseLoader status="Synthesizing Knowledge Node..." />}>
          <Routes>
            {/* ⚡ Landing - First route, always renders */}
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

              {/* Dashboard & Tabs */}
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

              {/* Learning Journey */}
              <Route path="/journey" element={
                <ProtectedRoute>
                  <LearningJourneyView 
                    result={assessmentResult} 
                    onStartSession={() => navigate('/runtime')} 
                    onViewDashboard={() => navigate('/dashboard')} 
                  />
                </ProtectedRoute>
              } />

              <Route path="/learning-journey" element={<Navigate to="/journey" replace />} />
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
                  <UserLeaderboardView onBack={() => navigate(-1)} currentUserId={user?.id || 'learner_prime'} />
                </ProtectedRoute>
              } />

              {/* Shared Runtime */}
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

              {/* Profile → Redirects to unified Dashboard */}
              <Route path="/profile" element={<Navigate to="/dashboard" replace />} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Suspense>
      </PrestigeErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DataProvider>
    </ThemeProvider>
  );
}
