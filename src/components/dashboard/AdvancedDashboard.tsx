import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, PenTool, Headphones, BookOpen, ChevronRight, 
  Map as MapIcon, Target, TrendingUp, AlertCircle, Play, CheckCircle2,
  Clock, Flame, BrainCircuit, Activity, LayoutDashboard, Dumbbell, 
  BarChart2, History, Settings, BookMarked, ArrowRight, Route, Crown, LogOut,
  Brain
} from 'lucide-react';

import { AssessmentSessionResult, AssessmentOutcome, SkillName, SkillAssessmentResult, AssessmentSkill } from '../../types/assessment';
import { AdvancedDashboardPayload } from '../../types/dashboard';
import { useSupabaseDashboard } from '../../hooks/useSupabaseDashboard';

interface AdvancedDashboardProps {
  result: AssessmentSessionResult;
  dashboardData: AdvancedDashboardPayload;
  assessmentOutcome?: AssessmentOutcome | null;
  onStartSession: () => void;
  onNavigateLeaderboard: () => void;
  onViewReview: () => void;
  onViewHistoryReport?: (id: string) => void;
  onLogout?: () => void;
  isArchitecting?: boolean;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const skillIcons: Record<string, React.ReactNode> = {
  speaking: <Mic className="w-5 h-5" />,
  writing: <PenTool className="w-5 h-5" />,
  listening: <Headphones className="w-5 h-5" />,
  vocabulary: <BookOpen className="w-4 h-4" />, // Using smaller for consistent look
  reading: <BookOpen className="w-5 h-5" />,
  grammar: <BrainCircuit className="w-5 h-5" />,
};

// Sidebar nav items
const sidebarItems = [
  { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'journey', label: 'Journey', icon: <Route className="w-5 h-5" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-5 h-5" /> },
  { id: 'hub', label: 'Practice', icon: <Dumbbell className="w-5 h-5" /> },
  { id: 'review', label: 'Review', icon: <BookMarked className="w-5 h-5" /> },
  { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({ result, dashboardData, assessmentOutcome, onStartSession, onNavigateLeaderboard, onViewReview, onViewHistoryReport, onLogout, isArchitecting }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const skills = useMemo(() => result ? Object.values(result.skills) : [], [result]);
  const supabaseData = useSupabaseDashboard();

  if (supabaseData.isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
         <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
           <p className="text-slate-500 font-bold animate-pulse">Syncing Learner Profile...</p>
         </div>
      </div>
    );
  }

  // Derive active values (favoring Database over temporary session memory)
  const isNewLearner = supabaseData.history.length === 0;
  const currentStreak = supabaseData.profile?.streak || dashboardData.weeklyRhythm.streakDays || 0;
  const totalPoints = supabaseData.profile?.points || 0;
  const currentLevel = supabaseData.profile?.currentLevel || result?.overall?.estimatedLevel || 'B1';

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col py-6 px-4 hidden md:flex">
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">AI Tutor</h1>
            <p className="text-xs text-slate-400 font-bold">{currentLevel} Learner</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button
            onClick={onNavigateLeaderboard}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent transition-all"
          >
            <Crown className="w-5 h-5" />
            Leaderboard
          </button>
        </nav>

        {/* Quick Stats Grid */}
        <div className="bg-slate-900 rounded-2xl p-4 text-white mt-4 grid grid-cols-2 gap-3 mb-2">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Streak</p>
            <p className="text-xl font-extrabold text-orange-400 flex items-center gap-1"><Flame className="w-4 h-4"/>{currentStreak}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Points</p>
            <p className="text-xl font-extrabold text-indigo-400">{totalPoints}</p>
          </div>
        </div>

        {onLogout && (
          <button onClick={onLogout} className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 py-8 px-6 md:px-10 overflow-y-auto max-w-5xl">
        {/* Mobile Tab Bar */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-4 mb-6">
          {sidebarItems.slice(0, 4).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
                activeTab === item.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ========= OVERVIEW ========= */}
          {activeTab === 'overview' && (
            <motion.div key="overview" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              {/* Header */}
              <motion.div variants={staggerItem} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">
                    Welcome back, {supabaseData.user?.fullName || 'Learner'}
                  </h1>
                  <p className="text-slate-500 font-medium">
                    {isNewLearner ? "Ready to map your language proficiency?" : dashboardData.primaryGoalText}
                  </p>
                </div>
                <button onClick={onStartSession} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98]">
                  <Play className="w-5 h-5 fill-white" /> {isNewLearner ? "Start Assessment" : "Continue Journey"}
                </button>
              </motion.div>

              {/* AI Learning Insights (Personalized Roadmap based on DB Errors) */}
              {supabaseData.errors.length > 0 && (
                <motion.section variants={staggerItem} className="bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-900/20 my-6 border border-indigo-800">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                         <div className="p-1.5 bg-indigo-500/30 rounded-lg"><Brain className="w-4 h-4 text-indigo-300" /></div>
                         <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-widest">Personalized Roadmap Insights</h2>
                      </div>
                      <h3 className="text-2xl font-black mb-4">Targeted Practice: {supabaseData.errors[0].category.replace(/_/g, ' ')}</h3>
                      <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm relative">
                         <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-400 rotate-45" />
                         <p className="text-indigo-50 leading-relaxed font-medium ml-2">
                           <strong className="text-amber-400">💡 Smart Tip:</strong> {supabaseData.errors[0].description}
                         </p>
                      </div>
                    </div>
                    <div className="w-full md:w-1/3 flex flex-col gap-3">
                       <button onClick={onStartSession} className="w-full bg-white text-indigo-900 hover:bg-slate-50 px-5 py-3.5 rounded-xl font-bold shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-2">
                         <Dumbbell className="w-4 h-4" /> Practice This Topic
                       </button>
                       <button onClick={() => setActiveTab('review')} className="w-full bg-indigo-800/50 hover:bg-indigo-800 text-indigo-100 hover:text-white border border-indigo-700 px-5 py-3.5 rounded-xl font-bold transition-all">
                         View All Insights
                       </button>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* Journey Card */}
              <motion.section variants={staggerItem} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="p-2.5 bg-indigo-100/50 rounded-xl text-indigo-600 border border-indigo-100"><MapIcon className="w-5 h-5"/></div>
                  <h2 className="text-xl font-bold text-slate-900">{dashboardData.journey.journeyTitle}</h2>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-3">
                    {dashboardData.journey.nodes.map((m, i) => (
                      <div key={m.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${m.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : m.status === 'current' ? 'bg-white border-indigo-600' : 'bg-slate-100 border-slate-200'}`}>
                            {m.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                            {m.status === 'current' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                          </div>
                          {i < dashboardData.journey.nodes.length - 1 && <div className={`w-0.5 h-full my-1 ${m.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                        <div className={`pb-3 ${m.status === 'locked' ? 'opacity-50' : ''}`}>
                          <h4 className={`font-bold ${m.status === 'current' ? 'text-indigo-900' : 'text-slate-700'}`}>{m.title}</h4>
                          <p className="text-sm text-slate-500">{m.description}{m.estimatedDuration ? ` • ${m.estimatedDuration}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="w-full md:w-1/3 bg-slate-50 p-5 rounded-2xl border border-slate-100 h-max">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Key Evidence</h3>
                    <ul className="space-y-2 text-slate-700 text-sm font-medium">
                      {result.overall.rationale.map((cap, i) => (
                        <li key={i} className="flex gap-2"><span className="text-emerald-500">✓</span>{cap}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.section>

              {/* Real DB Skill Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {supabaseData.skills.map(skill => {
                  const hasError = supabaseData.errors.some(e => e.category.toLowerCase().includes(skill.skillId.toLowerCase()));
                  return (
                    <motion.div key={skill.skillId} variants={staggerItem} className={`bg-white rounded-2xl p-5 border ${hasError ? 'border-amber-200 shadow-md shadow-amber-100/50' : skill.isCapped ? 'border-amber-100 shadow-sm' : 'border-slate-100 shadow-sm'} relative overflow-hidden`}>
                      {hasError && <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg">Needs Review</div>}
                      {skill.isCapped && !hasError && <div className="absolute top-0 right-0 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5"/> Capped</div>}
                      <div className="flex items-center gap-2 text-slate-600 font-bold capitalize mb-3">{skillIcons[skill.skillId]} {skill.skillId}</div>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-extrabold text-slate-900">{Math.round(skill.masteryScore)}</span>
                        {skill.masteryScore > 75 && <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />}
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div className={`h-full ${hasError ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${skill.masteryScore}%` }} />
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-400">
                        <span>Evidence Collected</span>
                        <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{skill.evidenceCount} hits</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Focus Areas */}
              {dashboardData.focusAreas.length > 0 && (
                <motion.section variants={staggerItem} className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                  <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> Active Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {dashboardData.focusAreas.map((area, i) => (
                      <span key={i} className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-100">{area}</span>
                    ))}
                  </div>
                </motion.section>
              )}
            </motion.div>
          )}

          {/* ========= ANALYTICS ========= */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Deep Analytics</h2>
                <p className="text-slate-500 text-sm">Detailed breakdowns of your learning signals and patterns.</p>
              </motion.div>

              {/* ===== Assessment Outcome Section ===== */}
              {assessmentOutcome ? (
                <>
                  {/* Overall Summary Card */}
                  <motion.section variants={staggerItem} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/60 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-indigo-100/50 rounded-xl text-indigo-600 border border-indigo-100"><BarChart2 className="w-5 h-5" /></div>
                        <h3 className="text-xl font-bold text-slate-900">Assessment Result</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 rounded-2xl border border-indigo-100 text-center">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Overall Level</p>
                          <p className="text-4xl font-extrabold text-indigo-700">{assessmentOutcome.overallBand}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Confidence</p>
                          <p className="text-3xl font-extrabold text-slate-900">{Math.round(assessmentOutcome.overallConfidence * 100)}%</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Questions</p>
                          <p className="text-3xl font-extrabold text-slate-900">{assessmentOutcome.totalQuestions}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Stop Reason</p>
                          <p className="text-lg font-bold text-slate-700 capitalize">{assessmentOutcome.stopReason?.replace(/_/g, ' ') || '—'}</p>
                        </div>
                      </div>
                      
                      {/* Detailed Review Action */}
                      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                         <div>
                            <h4 className="font-bold text-slate-800">Detailed Answer Analysis</h4>
                            <p className="text-xs text-slate-500">View individual task scores, grammar feedback, and explainers.</p>
                         </div>
                         <button 
                            onClick={onViewReview}
                            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl font-bold transition-all border border-indigo-100"
                         >
                            View Full Review Sheet <ArrowRight className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                  </motion.section>

                  {/* Per-Skill Outcome Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(Object.entries(assessmentOutcome.skillBreakdown) as [AssessmentSkill, typeof assessmentOutcome.skillBreakdown[AssessmentSkill]][]).map(([skillName, skillData]) => {
                      const bandColorClass = (() => {
                        const b = String(skillData.band);
                        if (b.startsWith('A')) return 'from-emerald-50 to-emerald-100/50 border-emerald-100';
                        if (b.startsWith('B')) return 'from-blue-50 to-blue-100/50 border-blue-100';
                        return 'from-purple-50 to-purple-100/50 border-purple-100';
                      })();
                      const bandTextClass = (() => {
                        const b = String(skillData.band);
                        if (b.startsWith('A')) return 'text-emerald-700';
                        if (b.startsWith('B')) return 'text-blue-700';
                        return 'text-purple-700';
                      })();
                      const statusColor = skillData.status === 'stable' ? 'bg-emerald-100 text-emerald-700' : skillData.status === 'emerging' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
                      return (
                        <motion.section key={skillName} variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
                                {skillIcons[skillName] || <Activity className="w-5 h-5" />}
                              </div>
                              <h4 className="font-bold text-slate-800 capitalize text-lg">{skillName}</h4>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl bg-gradient-to-br ${bandColorClass} border`}>
                              <span className={`text-xl font-extrabold ${bandTextClass}`}>{skillData.band}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Score</p>
                              <p className="text-2xl font-extrabold text-slate-900">{skillData.score}</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence</p>
                              <p className="text-2xl font-extrabold text-slate-900">{Math.round(skillData.confidence * 100)}%</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Evidence</p>
                              <p className="text-2xl font-extrabold text-slate-900">{skillData.evidenceCount}</p>
                            </div>
                          </div>
                          {/* Score bar */}
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                            <motion.div
                              className="h-full bg-indigo-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, skillData.score)}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${statusColor}`}>
                              {skillData.status?.replace(/_/g, ' ') || 'unknown'}
                            </span>
                            {skillData.speakingFallbackApplied && (
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-amber-50 text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Fallback
                              </span>
                            )}
                            {skillData.isCapped && (
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-amber-50 text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Capped
                              </span>
                            )}
                          </div>
                        </motion.section>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Empty State */
                <motion.section variants={staggerItem} className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <BarChart2 className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">No Assessment Result Yet</h3>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">Complete an adaptive assessment to unlock detailed skill analytics, per-level breakdowns, and confidence metrics.</p>
                  <button onClick={onStartSession} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)]">
                    Start Assessment
                  </button>
                </motion.section>
              )}

              {/* Per-Skill Deep Cards from Session Result (always shown if skills exist) */}
              {skills.length > 0 && (
                <>
                  <motion.div variants={staggerItem}>
                    <h3 className="text-lg font-bold text-slate-900 mt-4 mb-1">Session-Level Skill Analysis</h3>
                    <p className="text-slate-400 text-xs">Detailed per-skill breakdown from the processed session result.</p>
                  </motion.div>
                  {skills.map((skillRes: SkillAssessmentResult) => (
                    <motion.section key={skillRes.skill} variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 font-bold capitalize text-slate-800">
                          {skillIcons[skillRes.skill] || <Activity className="w-5 h-5" />} {skillRes.skill}
                        </div>
                        <span className="text-xl font-extrabold text-indigo-600">{skillRes.estimatedLevel}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mastery</p>
                          <p className="text-2xl font-extrabold text-slate-900">{Math.round((skillRes.masteryScore ?? skillRes.confidence.score) * 100)}%</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Evidence</p>
                          <p className="text-2xl font-extrabold text-slate-900">{skillRes.evidenceCount}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Consistency</p>
                          <p className="text-lg font-bold text-slate-800 capitalize">{skillRes.status}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence</p>
                          <p className="text-lg font-bold text-indigo-600 capitalize">{skillRes.confidence.band}</p>
                        </div>
                      </div>
                      {/* Subskill Bars */}
                      <div className="space-y-2">
                        {(skillRes.subscores || []).map(sub => (
                          <div key={sub.name} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500 w-32 text-right">{sub.name}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.round(sub.value * 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-600 w-8">{Math.round(sub.value * 100)}</span>
                          </div>
                        ))}
                      </div>
                    </motion.section>
                  ))}
                </>
              )}

              {/* Descriptor Evidence */}
              {skills.some(s => s.descriptors.length > 0) && (
                <motion.section variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-emerald-500" /> Evidence-Based Descriptors</h3>
                  <div className="space-y-3">
                    {skills.flatMap(s => s.descriptors).slice(0, 5).map((desc, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{desc.descriptorText}</p>
                          <p className="text-xs text-slate-500">Level: {desc.level} • Strength: {Math.round(desc.strength * 100)}%</p>
                        </div>
                        {desc.supported ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Behavioral Signals */}
              <motion.section variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /> Behavioral Profile</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pacing</p>
                    <p className="text-lg font-bold text-slate-800 capitalize">{result.behavioralProfile.pace}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence Style</p>
                    <p className="text-lg font-bold text-slate-800 capitalize">{result.behavioralProfile.confidenceStyle}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Self-Correction</p>
                    <p className="text-lg font-bold text-slate-800">{Math.round(result.behavioralProfile.selfCorrectionRate * 100)}%</p>
                  </div>
                </div>
              </motion.section>
            </motion.div>
          )}

          {/* ========= PRACTICE HUB ========= */}
          {activeTab === 'hub' && (
            <motion.div key="hub" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Practice Hub</h2>
                <p className="text-slate-500 text-sm">Curated exercises shaped by your learner state.</p>
              </motion.div>

              {/* Curated Skill Sections */}
              {[
                { skill: 'Speaking', icon: <Mic className="w-5 h-5" />, color: 'indigo', exercises: [
                  { title: 'Daily Conversation', type: 'Recommended', reason: 'Based on your current focus' },
                  { title: 'Roleplay: Coffee Shop', type: 'Confidence Builder', reason: 'Safe real-world scenario' },
                ]},
                { skill: 'Writing', icon: <PenTool className="w-5 h-5" />, color: 'emerald', exercises: [
                  { title: 'Formal Register Rewrite', type: 'Focus Area', reason: 'Addresses a growth zone' },
                  { title: 'Short Description', type: 'Warm-up', reason: 'Good for building rhythm' },
                ]},
                { skill: 'Listening', icon: <Headphones className="w-5 h-5" />, color: 'blue', exercises: [
                  { title: 'Detail Extraction', type: 'Stretch Challenge', reason: 'Push beyond your comfort zone' },
                  { title: 'Gist Comprehension', type: 'Review', reason: 'Strengthen a fragile area' },
                ]},
                { skill: 'Vocabulary', icon: <BookOpen className="w-5 h-5" />, color: 'amber', exercises: [
                  { title: 'Contextual Fill-in', type: 'Due for Review', reason: 'Items at risk of forgetting' },
                  { title: 'Contrast Pairs', type: 'Next Step', reason: 'Builds discriminative ability' },
                ]},
              ].map(section => (
                <motion.section key={section.skill} variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 bg-${section.color}-50 text-${section.color}-600 rounded-lg border border-${section.color}-100`}>{section.icon}</div>
                    <h3 className="font-bold text-lg text-slate-900">{section.skill}</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {section.exercises.map((ex, i) => (
                      <button key={i} onClick={onStartSession} className="flex flex-col text-left p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all bg-slate-50/50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">{ex.type}</span>
                        <h4 className="font-bold text-slate-800 mb-1">{ex.title}</h4>
                        <p className="text-xs text-slate-400">{ex.reason}</p>
                      </button>
                    ))}
                  </div>
                </motion.section>
              ))}
            </motion.div>
          )}

          {/* ========= REVIEW ========= */}
          {activeTab === 'review' && (
            <motion.div key="review" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              {/* Assessment Report Section */}
              <motion.section variants={staggerItem} className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200/50">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                       <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                       <h3 className="text-xl font-bold">Latest Assessment Report</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                       <div>
                          <p className="text-indigo-200 text-sm font-medium mb-1">Authenticated Proficiency</p>
                          <p className="text-4xl font-black">{result.overall.estimatedLevel} <span className="text-lg font-bold text-indigo-300">Level</span></p>
                       </div>
                       <button 
                          onClick={onViewReview}
                          className="w-full md:w-auto bg-white text-indigo-900 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
                       >
                          View Full Response Analysis
                       </button>
                    </div>
                 </div>
              </motion.section>

              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Review Queue</h2>
                <p className="text-slate-500 text-sm">Items that need reinforcement before they fade.</p>
              </motion.div>

              <motion.section variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                {dashboardData.reviewQueue.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">No items due for review right now.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {dashboardData.reviewQueue.map(item => (
                      <li key={item.itemId} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-800">{item.label}</p>
                          <p className="text-xs text-slate-400 capitalize">{item.type}</p>
                        </div>
                        <div className="flex gap-2">
                          {item.dueStatus === 'overdue' && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">Overdue</span>}
                          {item.fragility === 'high' && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded">Fragile</span>}
                          <button onClick={onStartSession} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">
                            Practice <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button onClick={onStartSession} className="w-full mt-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors">Start Review Session</button>
              </motion.section>

              {/* Weekly Rhythm */}
              <motion.section variants={staggerItem} className="bg-slate-900 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-800 text-indigo-400 rounded-lg"><Flame className="w-5 h-5"/></div>
                  <h3 className="font-bold text-lg">Weekly Rhythm</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Streak</p>
                    <p className="text-2xl font-extrabold text-orange-400">{dashboardData.weeklyRhythm.streakDays}</p>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Sessions</p>
                    <p className="text-2xl font-extrabold">{dashboardData.weeklyRhythm.sessionsThisWeek}</p>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded-xl text-center border border-slate-700">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Momentum</p>
                    <p className="text-lg font-bold text-emerald-400 capitalize">{dashboardData.weeklyRhythm.momentumState}</p>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden w-full">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500" style={{ width: '60%' }} />
                </div>
              </motion.section>
            </motion.div>
          )}

          {/* ========= JOURNEY ========= */}
          {activeTab === 'journey' && (
            <motion.div key="journey" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-10 pb-20">
              {/* Journey Header */}
              <motion.div variants={staggerItem} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-indigo-100/50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-3 border border-indigo-100 uppercase tracking-widest">
                       {isArchitecting ? (
                         <span className="flex items-center gap-2">
                           <BrainCircuit className="w-3 h-3 animate-pulse" /> 
                           AI Architecting Journey...
                         </span>
                       ) : 'Linguistic Roadmap'}
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{isArchitecting ? 'Visualizing your path...' : dashboardData.journey.journeyTitle}</h2>
                    <p className="text-slate-500 font-medium max-w-xl">{isArchitecting ? 'Our AI engine is currently analyzing your technical gaps to build a high-impact roadmap. This will take a few seconds.' : dashboardData.journey.targetCapabilitiesSummary}</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Current</p>
                      <p className="text-2xl font-black text-indigo-400">{dashboardData.journey.currentStage}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-700" />
                    <ArrowRight className="w-5 h-5 text-slate-500" />
                    <div className="h-10 w-px bg-slate-700" />
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Target</p>
                      <p className="text-2xl font-black text-emerald-400">{dashboardData.journey.targetStage}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Vertical Roadmap Container */}
              <div className="relative max-w-3xl mx-auto pl-8 md:pl-0">
                {/* Connecting Line */}
                <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500/20 via-indigo-500 to-indigo-500/10 -translate-x-1/2 rounded-full pointer-events-none" />
                
                <div className="space-y-12 relative">
                  {dashboardData.journey.nodes.map((node, index) => {
                    const isLeft = index % 2 === 0;
                    const isCompleted = node.status === 'completed';
                    const isCurrent = node.status === 'current';
                    const isLocked = node.status === 'locked';

                    return (
                      <motion.div 
                        key={node.id} 
                        variants={staggerItem}
                        className={`flex flex-col md:flex-row items-center gap-8 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                      >
                        {/* Content Card */}
                        <div className={`w-full md:w-[45%] ${isLeft ? 'md:text-right' : 'md:text-left'}`}>
                          <div className={`p-6 bg-white rounded-3xl border shadow-sm transition-all hover:shadow-md ${isCurrent ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-100'} ${isLocked ? 'opacity-60' : ''}`}>
                             <div className={`flex items-center gap-3 mb-2 ${isLeft ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                                <div className={`p-2 rounded-xl ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                   {skillIcons[node.iconType as any] || <Route className="w-5 h-5" />}
                                </div>
                                <h4 className="font-bold text-slate-800">{node.title}</h4>
                             </div>
                             <p className="text-sm text-slate-500 leading-relaxed">{node.description}</p>
                             {isCurrent && (
                               <button onClick={onStartSession} className="mt-4 w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
                                 Begin This Objective
                               </button>
                             )}
                          </div>
                        </div>

                        {/* Node Marker */}
                        <div className="absolute left-4 md:left-1/2 w-10 h-10 -translate-x-1/2 flex items-center justify-center z-10">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 ${isCompleted ? 'bg-emerald-500 border-emerald-100' : isCurrent ? 'bg-white border-indigo-600 animate-pulse' : 'bg-slate-100 border-slate-200'}`}>
                             {isCompleted ? <CheckCircle2 className="w-5 h-5 text-white" /> : 
                              isCurrent ? <div className="w-4 h-4 rounded-full bg-indigo-600" /> : 
                              <div className="w-3 h-3 rounded-full bg-slate-300" />}
                          </div>
                        </div>

                        {/* Spacer for other side */}
                        <div className="hidden md:block w-[45%]" />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Celebration Footer */}
              <motion.div variants={staggerItem} className="bg-emerald-900 rounded-3xl p-10 text-white text-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 blur-3xl -mr-32 -mt-32" />
                 <Crown className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                 <h3 className="text-2xl font-black mb-2">Final Objective: {dashboardData.journey.targetStage}</h3>
                 <p className="text-emerald-200 max-w-lg mx-auto mb-8 font-medium">Complete all bridge tasks and checkpoints to unlock the official assessment for your next level.</p>
                 <div className="flex justify-center gap-4">
                    <button onClick={onStartSession} className="bg-white text-emerald-900 px-8 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors">Start Current Path</button>
                 </div>
              </motion.div>
            </motion.div>
          )}

          {/* ========= HISTORY ========= */}
          {activeTab === 'history' && (
            <motion.div key="history" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Session History</h2>
                <p className="text-slate-500 text-sm">Your recent overarching assessment records pulled dynamically from the server.</p>
              </motion.div>
              <motion.section variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative">
                {supabaseData.history.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                      <Target className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">No Assessments Completed</h3>
                    <p className="text-slate-500 font-medium mb-6">Complete your first practice session to generate a comprehensive CEFR report card.</p>
                    <button onClick={onStartSession} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md shadow-indigo-200 transition-all">Start Your First Assessment</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supabaseData.history.map((record, i) => (
                      <div key={record.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group bg-slate-50/50">
                        <div className="flex items-center gap-4">
                           <div className="hidden md:flex w-12 h-12 bg-white rounded-full items-center justify-center border border-slate-200 shadow-sm">
                             <History className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{new Date(record.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                             <div className="flex items-center gap-3">
                               <h4 className="text-lg font-extrabold text-slate-800">Adaptive Diagnostics</h4>
                               <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] uppercase font-black tracking-widest rounded">Score: {record.overallLevel}</span>
                             </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-right hidden md:block mr-2">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Confidence</p>
                             <p className="text-sm font-bold text-slate-700">{Math.round(record.confidence * 100)}% reliability</p>
                           </div>
                           {onViewHistoryReport && (
                             <button onClick={() => onViewHistoryReport(record.id)} className="w-full md:w-auto px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold transition-colors">
                               View Detailed Report
                             </button>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.section>
            </motion.div>
          )}

          {/* ========= SETTINGS ========= */}
          {activeTab === 'settings' && (
            <motion.div key="settings" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Settings</h2>
                <p className="text-slate-500 text-sm">Manage your learning preferences.</p>
              </motion.div>
              <motion.section variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="text-center py-12">
                  <Settings className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Settings will be available soon.</p>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
