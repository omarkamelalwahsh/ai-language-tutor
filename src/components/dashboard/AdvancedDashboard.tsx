import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, PenTool, Headphones, BookOpen, ChevronRight, 
  Map as MapIcon, Target, TrendingUp, AlertCircle, Play, CheckCircle2,
  Clock, Flame, BrainCircuit, Activity, LayoutDashboard, Dumbbell, 
  BarChart2, History, Settings, BookMarked, ArrowRight, Route, Crown
} from 'lucide-react';

import { AssessmentSessionResult, AssessmentOutcome, SkillName, SkillAssessmentResult, AssessmentSkill } from '../../types/assessment';
import { AdvancedDashboardPayload } from '../../types/dashboard';

interface AdvancedDashboardProps {
  result: AssessmentSessionResult;
  dashboardData: AdvancedDashboardPayload;
  assessmentOutcome?: AssessmentOutcome | null;
  onStartSession: () => void;
  onNavigateLeaderboard: () => void;
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

export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({ result, dashboardData, assessmentOutcome, onStartSession, onNavigateLeaderboard }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const skills = useMemo(() => result ? Object.values(result.skills) : [], [result]);

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
            <p className="text-xs text-slate-400 font-bold">{result.overall.estimatedLevel} Learner</p>
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

        {/* Quick Stats */}
        <div className="bg-slate-900 rounded-2xl p-4 text-white mt-4">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">Streak</p>
          <p className="text-2xl font-extrabold text-orange-400 mb-1">{dashboardData.weeklyRhythm.streakDays} <span className="text-sm text-slate-500">days</span></p>
          <p className="text-xs text-slate-400">
            {dashboardData.isNewLearner ? "Complete first lesson to start" : `${dashboardData.weeklyRhythm.sessionsThisWeek} sessions this week`}
          </p>
        </div>
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
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">Welcome Back</h1>
                  <p className="text-slate-500 font-medium">{dashboardData.primaryGoalText}</p>
                </div>
                <button onClick={onStartSession} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98]">
                  <Play className="w-5 h-5 fill-white" /> {dashboardData.recommendedNextAction.label}
                </button>
              </motion.div>

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

              {/* Skill Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {dashboardData.skillAnalytics.map(skill => {
                  const isCapped = result.skills[skill.skillId]?.isCapped;
                  return (
                    <motion.div key={skill.skillId} variants={staggerItem} className={`bg-white rounded-2xl p-5 border ${skill.isPriority ? 'border-indigo-200 shadow-md shadow-indigo-100/50' : isCapped ? 'border-amber-100 shadow-sm' : 'border-slate-100 shadow-sm'} relative overflow-hidden`}>
                      {skill.isPriority && <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg">Priority</div>}
                      {isCapped && <div className="absolute top-0 right-0 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-bl-lg flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5"/> Capped</div>}
                      <div className="flex items-center gap-2 text-slate-600 font-bold capitalize mb-3">{skillIcons[skill.skillId]} {skill.skillId}</div>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-extrabold text-slate-900">{skill.currentScore}</span>
                        {skill.progressDirection === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />}
                        {skill.stability === 'fragile' && <AlertCircle className="w-4 h-4 text-amber-500 mb-1" />}
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div className={`h-full ${skill.isPriority ? 'bg-indigo-500' : isCapped ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${skill.currentScore}%` }} />
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-400">
                        <span>Confidence</span>
                        <span className={`px-1.5 py-0.5 rounded ${skill.confidenceBand === 'high' ? 'bg-emerald-50 text-emerald-600' : skill.confidenceBand === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>{skill.confidenceBand}</span>
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
            <motion.div key="journey" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-6">
              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Level Journey</h2>
                <p className="text-slate-500 text-sm">Track your progress, consistency, and path to your next level.</p>
              </motion.div>
              {dashboardData.isNewLearner ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center">
                   <Target className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
                   <h3 className="text-xl font-bold text-slate-800 mb-2">Initial Diagnostic Complete</h3>
                   <p className="text-slate-500 mb-6">You are professionally assessed at the <strong>{result.overall.estimatedLevel}</strong> level.</p>
                   <button onClick={onStartSession} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">Begin Learning Journey</button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p>Journey view coming soon...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ========= HISTORY ========= */}
          {activeTab === 'history' && (
            <motion.div key="history" variants={staggerContainer} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
              <motion.div variants={staggerItem}>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Session History</h2>
                <p className="text-slate-500 text-sm">Your recent learning sessions and outcomes.</p>
              </motion.div>
              <motion.section variants={staggerItem} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Complete your first practice session to see history here.</p>
                  <button onClick={onStartSession} className="mt-4 text-indigo-600 font-bold text-sm hover:text-indigo-800">Start a Session →</button>
                </div>
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
