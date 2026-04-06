import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { OnboardingState, ViewState } from './types/app';
import { AssessmentSessionResult, AssessmentOutcome, TaskEvaluation } from './types/assessment';
import { DashboardService } from './services/DashboardService';

// Views
import { RoleSelectionView } from './views/RoleSelectionView';
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
import { Code, X } from 'lucide-react';

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
  const [view, setView] = useState<ViewState>('ROLE_SELECTION');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [taskResults, setTaskResults] = useState<TaskEvaluation[]>([]);
  const [assessmentOutcome, setAssessmentOutcome] = useState<AssessmentOutcome | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentSessionResult | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [devModeActive, setDevModeActive] = useState(false);
  const [isArchitecting, setIsArchitecting] = useState(false);

  // 💾 State Persistence: Load from localStorage on mount
  React.useEffect(() => {
    const savedResult = localStorage.getItem('last_assessment_result');
    const savedOutcome = localStorage.getItem('last_assessment_outcome');
    const savedEvaluations = localStorage.getItem('last_assessment_evals');

    if (savedResult) setAssessmentResult(JSON.parse(savedResult));
    if (savedOutcome) setAssessmentOutcome(JSON.parse(savedOutcome));
    if (savedEvaluations) setTaskResults(JSON.parse(savedEvaluations));
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
  }, [assessmentResult]); // Only run when assessmentResult changes

  const navigateTo = (newView: ViewState) => {
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="font-sans antialiased text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900 bg-slate-50 min-h-screen">
      <DevModeOverlay result={assessmentResult} show={devModeActive} onClose={() => setDevModeActive(false)} />

      <AnimatePresence mode="wait">
        {view === 'ROLE_SELECTION' && (
          <RoleSelectionView 
            onSelectRole={(role) => {
              setUserRole(role);
              navigateTo('AUTH');
            }} 
          />
        )}

        {view === 'LANDING' && (
          <LandingView 
            key="landing" 
            onGetStarted={() => navigateTo('AUTH')} 
            onSignIn={() => navigateTo('AUTH')} 
          />
        )}

        {view === 'AUTH' && (
          <AuthView 
            role={userRole}
            onBack={() => navigateTo('ROLE_SELECTION')}
            onLogin={(role) => {
              if (role === 'admin') {
                navigateTo('ADMIN_DASHBOARD');
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
            onComplete={(results, outcome) => {
              setTaskResults(results);
              setAssessmentOutcome(outcome);
              navigateTo('ANALYZING');
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
            onBack={() => navigateTo('RESULT_ANALYSIS')}
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

        {view === 'DASHBOARD' && assessmentResult && (
          <FadeTransition key="dashboard" className="min-h-screen bg-slate-50">
            <AdvancedDashboard
              result={assessmentResult}
              dashboardData={dashboardData || DashboardService.buildPayload(assessmentResult)}
              assessmentOutcome={assessmentOutcome}
              onStartSession={() => navigateTo('LEARNING_LOOP')}
              onNavigateLeaderboard={() => navigateTo('USER_LEADERBOARD')}
              onViewReview={() => navigateTo('ASSESSMENT_REVIEW')}
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
