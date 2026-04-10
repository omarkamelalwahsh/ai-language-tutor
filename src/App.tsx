import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';

// Context
import { DataProvider, useData } from './context/DataContext';

// Views
import { AuthView } from './views/AuthView';
import { OnboardingView } from './views/OnboardingView';
import { PreAssessmentIntroView } from './views/PreAssessmentIntroView';
import { DiagnosticView } from './views/DiagnosticView';
import { LandingView } from './views/LandingView';
import { FadeTransition } from './lib/animations';
import { DashboardService } from './services/DashboardService';
import { useMemo } from 'react';

import { AdminDashboardView } from './views/AdminDashboardView';
import { AdminLeaderboardView } from './views/AdminLeaderboardView';
import { UserLeaderboardView } from './views/UserLeaderboardView';

// Components
import { AssessmentReviewView } from './views/AssessmentReviewView';
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

// Helper for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isInitializing, profile } = useData();
  const location = window.location.pathname;

  // 1. Loading Guard (Wait for both Auth AND Profile before deciding)
  if (isInitializing || (user && !profile)) return <LoadingScreen />;
  
  // 2. Auth Guard
  if (!user) return <Navigate to="/auth" />;

  // 3. Onboarding Guard (Persistence & Resume Logic)
  if (profile && !profile.onboarding_complete) {
    // If not onboarded, only allow assessment-related routes
    const isAtAssessment = location.includes('diagnostic') || location.includes('onboarding');
    if (!isAtAssessment) {
      return <Navigate to="/onboarding" />;
    }
  }

  return <>{children}</>;
};

// Helper for public/auth routes
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isInitializing, profile } = useData();
  
  // 🛡️ RACE CONDITION KILLER: Wait for both Auth AND Profile
  if (isInitializing || (user && !profile)) return <LoadingScreen />;
  
  if (user && profile) {
    if (profile.onboarding_complete) return <Navigate to="/dashboard" />;
    return <Navigate to="/onboarding" />;
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
    isArchitecting, logout, refreshData, devModeActive 
  } = useData() as any;

  const dashboardData = useMemo(() => DashboardService.buildPayload(assessmentResult), [assessmentResult]);

  const handleAssessmentSave = async (result: any, outcome: any, evals: any) => {
    try {
      // 1. Persist session data locally + trigger DB save (Now Atomic RPC)
      await setSessionResult(result, outcome, evals);
      
      // 2. Re-fetch profile from DB to ensure onboarding_complete is TRUE
      await refreshData();
      
      // 3. Frontend Guarantee: Force full browser redirect to kill stale state
      console.log('[AppRoutes] 🚀 Finalizing with Frontend Guarantee redirect...');
      window.location.assign('/dashboard');
    } catch (error) {
      console.error('[AppRoutes] Assessment save failed:', error);
      // Fallback redirect
      window.location.assign('/dashboard');
    }
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
              <PreAssessmentIntroView onStartAssessment={() => navigate('/diagnostic')} onBack={() => navigate('/dashboard')} />
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
                onLogout={async () => { 
                  await logout(); 
                  // Brief delay to ensure state and localStorage are fully cleared 
                  setTimeout(() => navigate('/'), 10);
                }}
                isArchitecting={isArchitecting}
              />
            </ProtectedRoute>
          } />

          {/* Journey, Analytics, Practice, Review, History - All are tabs in Dashboard */}
          <Route path="/journey" element={<Navigate to="/dashboard/journey" />} />
          <Route path="/analytics" element={<Navigate to="/dashboard/analytics" />} />
          <Route path="/practice" element={<Navigate to="/dashboard/hub" />} />
          <Route path="/review" element={<Navigate to="/dashboard/review" />} />
          <Route path="/history" element={<Navigate to="/dashboard/history" />} />

          {/* Review Deep Dive */}
          <Route path="/review/:sessionId" element={
            <ProtectedRoute>
              <AssessmentReviewView 
                evaluations={taskResults}
                assessmentId={window.location.pathname.split('/').pop() === 'latest' ? undefined : window.location.pathname.split('/').pop()}
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
                onLogout={() => {}}
              />
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
