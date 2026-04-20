import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, PenTool, Headphones, BookOpen, ChevronRight, CheckCircle2,
  Target, MapPin, TrendingUp, Shield, ArrowRight, Sparkles, Star
} from 'lucide-react';
import { LearnerModelSnapshot, LearningPlan, CEFRLevel } from '../../types/learner-model';
import { LearningPlanService } from '../../services/LearningPlanService';

interface AssessmentResultsProps {
  model: LearnerModelSnapshot;
  segment: 'casual' | 'serious' | 'professional' | null;
  onStartSession: () => void;
  onViewDashboard: () => void;
}

const skillIcons: Record<string, React.ReactNode> = {
  speaking: <Mic className="w-5 h-5" />,
  writing: <PenTool className="w-5 h-5" />,
  listening: <Headphones className="w-5 h-5" />,
  vocabulary: <BookOpen className="w-5 h-5" />,
};

const nextLevelMap: Record<string, string> = {
  'Pre-A1': 'A1', 'A1': 'A2', 'A1+': 'A2', 'A2': 'B1', 'A2+': 'B1',
  'B1': 'B2', 'B1+': 'B2', 'B2': 'C1', 'B2+': 'C1', 'C1': 'C2', 'C2': 'C2'
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } }
};
const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const LearnerInterpretation: React.FC<AssessmentResultsProps> = ({
  model, segment, onStartSession, onViewDashboard
}) => {
  const [activeSection, setActiveSection] = useState<'results' | 'plan' | 'journey'>('results');
  const plan = useMemo(() => LearningPlanService.generatePlan(model, segment), [model, segment]);
  const targetLevel = nextLevelMap[model.overallLevel] || 'A2';

  const confidenceLabel = (c: number) => {
    if (c >= 0.7) return { text: 'High certainty', color: 'text-emerald-600 bg-emerald-50' };
    if (c >= 0.4) return { text: 'Moderate certainty', color: 'text-amber-600 bg-amber-50' };
    return { text: 'Limited evidence', color: 'text-red-500 bg-red-50' };
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-8">

        {/* Hero Header */}
        <motion.header variants={staggerItem} className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold border border-indigo-100">
            <Sparkles className="w-4 h-4" /> Assessment Complete
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Your Personalized Path is Ready</h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            We've analyzed your responses across {Object.keys(model.skills).length} core skills to build a learning plan tailored to your current abilities.
          </p>
        </motion.header>

        {/* Overall Level Card */}
        <motion.div variants={staggerItem} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
          <div className="text-center md:text-left flex-1">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Your Starting Level</p>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-6xl font-black text-blue-600 dark:text-blue-400">{model.overallLevel}</span>
              <ArrowRight className="w-6 h-6 text-slate-300" />
              <span className="text-2xl font-bold text-slate-400">{targetLevel}</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-md">
              This is based on your performance across speaking, writing, listening, and vocabulary tasks. Your path from <strong>{model.overallLevel}</strong> to <strong>{targetLevel}</strong> starts now.
            </p>
          </div>
          <div className="w-full md:w-1/3 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm">
            <h4 className="font-bold text-slate-600 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" /> Confidence Level
            </h4>
            <p className="text-slate-500 leading-relaxed">
              {model.confidence.state === 'fragile'
                ? "We noticed some uncertainty during the assessment. Your path will begin with guided, confidence-building tasks."
                : model.confidence.state === 'resilient'
                  ? "You showed strong recovery after difficult tasks. Your path will include challenges early."
                  : "Your assessment showed a steady, balanced approach. Your path will mix guided and independent work."}
            </p>
          </div>
        </motion.div>

        {/* Section Tabs */}
        <motion.div variants={staggerItem} className="flex items-center gap-6 border-b border-slate-200">
          {[
            { id: 'results', label: 'Skill Breakdown' },
            { id: 'plan', label: 'Your First Plan' },
            { id: 'journey', label: 'Level Journey' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`pb-3 text-sm font-bold tracking-wide uppercase transition-colors relative ${activeSection === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
              {activeSection === tab.id && (
                <motion.div layoutId="resultTab" className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 dark:bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeSection === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Per-Skill Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(Object.entries(model.skills) as [string, typeof model.skills.speaking][]).map(([skillId, dim]) => {
                  const cl = confidenceLabel(dim.confidence);
                  return (
                    <div key={skillId} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 text-slate-700 font-bold capitalize">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 border border-indigo-100">{skillIcons[skillId]}</div>
                          {skillId}
                        </div>
                        <span className="text-2xl font-black text-slate-900">{dim.level}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${dim.score}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">Score: {dim.score}/100</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${cl.color}`}>{cl.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Growth Zones & Strengths */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-blue-50 dark:bg-blue-900/30/50 p-6 rounded-2xl border border-indigo-100">
                  <h3 className="text-indigo-900 font-bold mb-4 flex items-center gap-2"><Target className="w-4 h-4" /> Growth Zones</h3>
                  <ul className="space-y-2">
                    {model.interpretation.growthZones.map((z, i) => (
                      <li key={i} className="text-indigo-800 text-sm flex gap-2 items-start"><span className="text-indigo-400 mt-0.5">›</span> {z}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="text-emerald-900 font-bold mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> What You Can Already Do</h3>
                  <ul className="space-y-2">
                    {model.interpretation.currentCapacities.map((c, i) => (
                      <li key={i} className="text-emerald-800 text-sm flex gap-2 items-start"><span className="text-emerald-400 mt-0.5">✓</span> {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Primary Goal</h3>
                  <p className="text-slate-600 leading-relaxed">{plan.primaryObjective}</p>
                </div>
                {plan.secondaryObjective && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Secondary</h3>
                    <p className="text-slate-500 text-sm">{plan.secondaryObjective}</p>
                  </div>
                )}
                <hr className="border-slate-100" />
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-1">Support Level</p>
                    <p className="font-bold text-slate-800 capitalize">{plan.initialSupportProfile}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-1">Session Length</p>
                    <p className="font-bold text-slate-800">~{plan.recommendedSessionBlueprint.estimatedMinutes} min</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-400 uppercase text-xs tracking-widest mb-1">Motivation Style</p>
                    <p className="font-bold text-slate-800 capitalize">{plan.motivationStyleHint.replace(/-/g, ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Session 1 Preview */}
              <div className="bg-blue-50 dark:bg-blue-900/30/50 rounded-2xl p-6 border border-indigo-100">
                <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2"><Star className="w-4 h-4" /> Session 1 Preview</h3>
                <p className="text-indigo-800 text-sm mb-3">Your first session will focus on <strong>{plan.recommendedSessionBlueprint.focusSkill}</strong>{plan.recommendedSessionBlueprint.secondarySkill ? ` with some ${plan.recommendedSessionBlueprint.secondarySkill}` : ''}.</p>
                <div className="flex flex-wrap gap-2">
                  {plan.recommendedSessionBlueprint.taskSequence.map((t, i) => (
                    <span key={i} className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 capitalize">{t.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>

              {/* Pacing & Confidence Hints */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-700 text-sm mb-2">Pacing Strategy</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{plan.pacingHint}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-700 text-sm mb-2">Confidence Support</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{plan.confidenceSupportHint}</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'journey' && (
            <motion.div key="journey" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Your Journey from {model.overallLevel} to {targetLevel}</h3>
                <p className="text-slate-500 mb-6 text-sm">This roadmap shows the major milestones you'll work through to reach your next level.</p>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">What You Can Do Now ({model.overallLevel})</h4>
                    <ul className="space-y-1.5">
                      {model.interpretation.currentCapacities.map((c, i) => (
                        <li key={i} className="text-sm text-slate-600 flex gap-2"><span className="text-emerald-500">✓</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-5 rounded-xl border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">What You'll Build Toward ({targetLevel})</h4>
                    <ul className="space-y-1.5 text-sm text-indigo-800">
                      <li className="flex gap-2"><MapPin className="w-3 h-3 mt-1 text-indigo-400 flex-shrink-0" />Confident everyday communication</li>
                      <li className="flex gap-2"><MapPin className="w-3 h-3 mt-1 text-indigo-400 flex-shrink-0" />Clearer sentence building and follow-up</li>
                      <li className="flex gap-2"><MapPin className="w-3 h-3 mt-1 text-indigo-400 flex-shrink-0" />Broader vocabulary in familiar contexts</li>
                      <li className="flex gap-2"><MapPin className="w-3 h-3 mt-1 text-indigo-400 flex-shrink-0" />Stronger listening comprehension in real speech</li>
                    </ul>
                  </div>
                </div>

                {/* Milestone Timeline */}
                <div className="space-y-4">
                  {[
                    { title: 'Daily Conversation Basics', desc: 'Greetings, introductions, simple questions', status: 'done' },
                    { title: 'Practical Vocabulary Growth', desc: 'Core nouns, verbs, and connectors for routine use', status: 'current' },
                    { title: 'Stronger Sentence Building', desc: 'Compound sentences, conjunctions, and time markers', status: 'locked' },
                    { title: 'Routine Communication', desc: 'Ordering food, asking directions, making plans', status: 'locked' },
                    { title: 'Improved Spoken Confidence', desc: 'Spontaneous interaction and recovery after errors', status: 'locked' },
                  ].map((m, i, arr) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${m.status === 'done' ? 'bg-emerald-500 border-emerald-500' : m.status === 'current' ? 'bg-white border-indigo-600' : 'bg-slate-100 border-slate-200'}`}>
                          {m.status === 'done' && <CheckCircle2 className="w-4 h-4 text-white" />}
                          {m.status === 'current' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-600" />}
                        </div>
                        {i < arr.length - 1 && <div className={`w-0.5 flex-1 my-1 ${m.status === 'done' ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                      </div>
                      <div className={`pb-5 ${m.status === 'locked' ? 'opacity-50' : ''}`}>
                        <h4 className={`font-bold ${m.status === 'current' ? 'text-indigo-900' : 'text-slate-700'}`}>{m.title}</h4>
                        <p className="text-sm text-slate-500">{m.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTAs */}
        <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4 pt-4">
          <button
            onClick={onStartSession}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 dark:bg-blue-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98]"
          >
            Start Session 1 <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={onViewDashboard}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold transition-all hover:bg-slate-50"
          >
            Go to Dashboard
          </button>
        </motion.div>

      </motion.div>
    </div>
  );
};
