import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { OnboardingState, ViewState } from './types/app';
import { LearnerModelSnapshot } from './types/learner-model';
import { DashboardService } from './services/DashboardService';

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
import { LearningJourneyView } from './views/LearningJourneyView';
import { AdvancedDashboard } from './components/dashboard/AdvancedDashboard';
import { SharedRuntime } from './components/runtime/SharedRuntime';

// Dev Mode overlay
import { motion } from 'motion/react';
import { Code, X } from 'lucide-react';

const DevModeOverlay = ({ model, show, onClose }: { model: LearnerModelSnapshot | null; show: boolean; onClose: () => void }) => (
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
            <pre>{JSON.stringify({ learnerModelSnapshot: model }, null, 2)}</pre>
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
  const [taskResults, setTaskResults] = useState<any[]>([]);
  const [learnerModel, setLearnerModel] = useState<LearnerModelSnapshot | null>(null);
  const [devModeActive, setDevModeActive] = useState(false);

  const navigateTo = (newView: ViewState) => {
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="font-sans antialiased text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900 bg-slate-50 min-h-screen">
      <DevModeOverlay model={learnerModel} show={devModeActive} onClose={() => setDevModeActive(false)} />

      <AnimatePresence mode="wait">
        {view === 'LANDING' && (
          <LandingView 
            key="landing" 
            onGetStarted={() => navigateTo('AUTH')} 
            onSignIn={() => navigateTo('AUTH')} 
          />
        )}

        {view === 'AUTH' && (
          <AuthView key="auth" onLogin={(role) => {
            setUserRole(role);
            if (role === 'admin') {
              navigateTo('ADMIN_DASHBOARD');
            } else {
              navigateTo('ONBOARDING');
            }
          }} />
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
          <DiagnosticView key="diagnostic" onComplete={(results) => {
            setTaskResults(results);
            navigateTo('ANALYZING');
          }} />
        )}

        {view === 'ANALYZING' && (
          <AnalyzingView key="analyzing" onboardingState={onboardingState} taskResults={taskResults} onComplete={(model) => {
            setLearnerModel(model);
            navigateTo('RESULT_ANALYSIS');
          }} />
        )}

        {view === 'RESULT_ANALYSIS' && learnerModel && (
          <ResultAnalysisView
            key="result_analysis"
            model={learnerModel}
            onContinue={() => navigateTo('LEARNING_JOURNEY')}
          />
        )}

        {view === 'LEARNING_JOURNEY' && learnerModel && (
          <LearningJourneyView
            key="learning_journey"
            model={learnerModel}
            onStartSession={() => navigateTo('LEARNING_LOOP')}
            onViewDashboard={() => navigateTo('DASHBOARD')}
          />
        )}

        {view === 'DASHBOARD' && learnerModel && (
          <FadeTransition key="dashboard" className="min-h-screen bg-slate-50">
            <AdvancedDashboard
              learnerModel={learnerModel}
              dashboardData={DashboardService.buildPayload(learnerModel)}
              onStartSession={() => navigateTo('LEARNING_LOOP')}
              onNavigateLeaderboard={() => navigateTo('USER_LEADERBOARD')}
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

        {view === 'LEARNING_LOOP' && learnerModel && (
          <SharedRuntime key="learning_loop" learnerModel={learnerModel} onExit={() => navigateTo('DASHBOARD')} />
        )}
      </AnimatePresence>
    </div>
  );
}
