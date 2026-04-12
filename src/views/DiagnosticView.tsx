import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MessageSquare, 
  Focus, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  RefreshCcw, 
  SkipForward, 
  Brain, 
  Trophy,
  History,
  LayoutDashboard,
  Map as MapIcon,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  Home,
  BookOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

import { AssessmentQuestion, AssessmentOutcome, ResponseMode, SpeakingSubmissionMeta, LearnerContextProfile, TaskEvaluation } from '../types/assessment';
import { AdaptiveAssessmentEngine } from '../services/AdaptiveAssessmentEngine';
import { AssessmentSaveService } from '../services/AssessmentSaveService';
import { TaskResult, OnboardingState } from '../types/app';
import { SessionTask } from '../types/runtime';
import { AudioPlaybackControl } from '../components/shared/AudioPlaybackControl';
import { SpeakingModule } from '../components/runtime/modules/SpeakingModule';

// --- Types ---
interface DiagnosticViewProps {
  onboardingState?: OnboardingState | null;
  taskResults?: TaskEvaluation[]; 
  onSaveComplete: (results: TaskResult[], outcome: AssessmentOutcome) => void;
}

// ============================================================================
// MAIN DIAGNOSTIC VIEW (ENTERPRISE LIGHT THEME)
// ============================================================================
export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ onSaveComplete, onboardingState, taskResults }) => {
  const navigate = useNavigate();
  const { refreshData: refreshUserProfile, logout, user } = useData() as any;
  const fullName = user?.fullName || 'Omar Kamel';

  // --- Engine Persistence ---
  const engineRef = useRef<AdaptiveAssessmentEngine | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!engineRef.current) {
    const startBand: any = 'B1';
    const contextProfile: LearnerContextProfile | undefined = onboardingState ? {
      goal: onboardingState.goal || undefined,
      goalContext: onboardingState.goalContext || undefined,
      preferredTopics: (onboardingState.topics || []) as string[],
    } : undefined;

    const engine = new AdaptiveAssessmentEngine(startBand, contextProfile, null);
    if (taskResults && taskResults.length > 0) {
      engine.initializeFromHistory(taskResults, []); 
    }
    engineRef.current = engine;
  }

  const engine = engineRef.current;
  const [currentTask, setCurrentTask] = useState<AssessmentQuestion | null>(null);
  const [progress, setProgress] = useState(engine.getProgress());
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // --- New Input State ---
  const [textValue, setTextValue] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [useSpeakingFallback, setUseSpeakingFallback] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  // Reset timer on task change
  useEffect(() => {
    if (currentTask) {
      startTimeRef.current = Date.now();
      setTextValue("");
      setSelectedOption(null);
      setUseSpeakingFallback(false);
    }
  }, [currentTask?.id]);

  // --- Handlers ---
  const handleFinish = useCallback(async () => {
    setIsSaving(true); 
    setIsCompleting(true);
    try {
      // 1. Finalize the academic scoring (EFSET Model) - keep as fallback/base
      await engine.finalizeAssessment(); 
      await refreshUserProfile().catch(err => console.warn('User profile refresh failed:', err)); 
      
      const academicOutcome = engine.getOutcome();
      const history = engine.getAnswerHistory();

      // 2. Trigger Cloud AI Analysis (Grok-Scorer + Grok-Expert)
      console.log('[Diagnostic] ☁️ Launching Grok Analysis Layer...');
      const deepAnalysis = await AssessmentSaveService.analyzeAssessmentRemote(history);

      // 3. Complete saving state
      onSaveComplete(history, { ...academicOutcome, aiAnalysis: deepAnalysis });
    } catch (e) {
      console.error('[Diagnostic] ❌ Finalization aborted.', e);
      setSaveError('A critical failure occurred during AI analysis. Falling back to local scoring.');
      
      // Fallback: Continue with local academic scoring if AI fails
      try {
        const academicOutcome = engine.getOutcome();
        onSaveComplete(engine.getAnswerHistory(), academicOutcome);
      } catch (innerE) {
        setTimeout(() => navigate('/dashboard', { replace: true }), 3000);
      }
    }
  }, [engine, navigate, refreshUserProfile, onSaveComplete]);

  useEffect(() => {
    let isSubscribed = true;
    if (!currentTask) {
      const loadInitial = async () => {
        const firstQ = await engine.getNextQuestion();
        if (isSubscribed) {
          if (firstQ) {
            setCurrentTask(firstQ);
            setProgress(engine.getProgress());
          } else {
            await handleFinish();
          }
        }
      };
      loadInitial();
    }
    return () => { isSubscribed = false; };
  }, [engine, currentTask, handleFinish]);

  const handleNextTask = useCallback(
    async (answer: string, responseMode?: ResponseMode, speakingMeta?: SpeakingSubmissionMeta) => {
      if (!currentTask || isEvaluating) return;
      
      const responseTime = Date.now() - startTimeRef.current;
      setIsEvaluating(true);
      
      try {
        const { evaluation } = await engine.submitAnswer(currentTask, answer, responseTime, responseMode, speakingMeta);
        await AssessmentSaveService.log_and_update_assessment(currentTask, evaluation, answer);
        
        setProgress(engine.getProgress());
        const nextQ = await engine.getNextQuestion();
        if (nextQ) {
          setCurrentTask(nextQ);
          setProgress(engine.getProgress());
        } else {
          await handleFinish();
        }
      } catch (err) {
        console.error("⚠️ [DiagnosticView] Error:", err);
        const nextQ = await engine.getNextQuestion();
        if (nextQ) setCurrentTask(nextQ);
        else await handleFinish();
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentTask, engine, isEvaluating, handleFinish]
  );

  const handleSkip = useCallback(async () => {
    if (!currentTask || isEvaluating) return;
    setIsEvaluating(true);
    try {
      const nextQ = await engine.skipQuestion(currentTask.id);
      if (nextQ) {
        setCurrentTask(nextQ);
        setProgress(engine.getProgress());
      } else {
        await handleFinish();
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [currentTask, isEvaluating, engine, handleFinish]);

  // --- Render Logic ---
  if (isCompleting) return <SyncingView isSaving={isSaving} saveError={saveError} />;
  if (!currentTask) return <LoadingSkeleton />;

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden relative">
      
      {/* 1. Sidebar (Inactive for Diagnostic, but present for UI consistency) */}
      <aside className="w-64 bg-[#0B1437] flex flex-col p-6 shrink-0 z-10 hidden md:flex rounded-br-3xl shadow-xl">
        <div className="flex items-center gap-3 mb-10 px-2 opacity-50 cursor-not-allowed">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500 shadow-lg shadow-blue-500/30">
             <Trophy size={20} className="text-white" fill="currentColor" />
          </div>
          <div><h1 className="text-xl font-black text-white leading-tight tracking-tight">Career Copilot</h1></div>
        </div>
        
        <nav className="space-y-1.5 flex-1 opacity-50">
          <NavItem icon={<Home size={18}/>} label="Home" active={false} />
          <NavItem icon={<MapIcon size={18}/>} label="My Path" active={true} />
          <NavItem icon={<BarChart3 size={18}/>} label="Analytics" active={false} />
          <NavItem icon={<History size={18}/>} label="History" active={false} />
        </nav>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-[72px] bg-[#F8FAFC]/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 relative z-20">
           {/* Mockup 2 Header: My Path | Analytics */}
           <div className="flex items-center gap-8 text-sm font-bold text-slate-400">
              <span className="text-slate-800 border-b-2 border-blue-600 pb-1 px-1 transition-all cursor-default">My Path</span>
              <span className="hover:text-slate-600 cursor-pointer px-1">Analytics</span>
           </div>
           
           <div className="flex items-center gap-4">
              <button className="relative p-2 bg-white rounded-full border border-slate-200 text-slate-400 shadow-sm">
                 <Bell size={18} />
                 <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
              </button>
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                 <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${fullName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full" />
              </div>
           </div>
        </header>

        {/* Diagnostic Split Layout (Mockup 2) */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row p-6 md:p-8 gap-6 md:gap-8 overflow-y-auto lg:overflow-hidden lg:pb-8">
            
            {/* Left: Question Card (8/12 equivalent) */}
            <section className="flex-1 flex flex-col min-w-0 h-full">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-10 flex-1 flex flex-col relative overflow-hidden group hover:shadow-md transition duration-300">
                    
                    {/* Progress & Breadcrumb */}
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                           Question {progress.answered + 1}/{progress.total} 
                           <span className="text-slate-300 font-medium normal-case ml-2">
                             (Skill Focus: {currentTask.skill.charAt(0).toUpperCase() + currentTask.skill.slice(1)} - Wildcard Phase)
                           </span>
                        </span>
                    </div>

                    {/* Progress Bar (Mockup 2 Style) */}
                    <div className="h-2 w-full bg-slate-100 rounded-full mb-10 overflow-hidden shadow-inner flex">
                        <motion.div 
                           className="h-full bg-[#1A73E8] transition-all"
                           initial={{ width: `${(progress.answered / progress.total) * 100}%` }}
                           animate={{ width: `${((progress.answered + 1) / progress.total) * 100}%` }}
                        />
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={currentTask.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col"
                          >
                             <div className="flex items-start gap-5">
                                <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                                   {progress.answered + 1}.
                                </span>
                                <div className="space-y-8 flex-1">
                                   <div className={`p-6 bg-[#F8F9FA] rounded-2xl border border-slate-100 text-slate-700 leading-relaxed font-medium transition duration-500 ${isEvaluating ? 'opacity-40 grayscale blur-[1px]' : ''}`}>
                                       {currentTask.stimulus || (currentTask as any).text || currentTask.prompt}
                                   </div>

                                   {/* Multiple Choice Options */}
                                   {['mcq', 'fill_blank', 'reading_mcq', 'listening_mcq'].includes(currentTask.type) && currentTask.options && (
                                      <div className="grid gap-3 overflow-y-auto pr-2">
                                         {currentTask.options.map((opt, i) => (
                                           <button
                                             key={i}
                                             onClick={() => handleNextTask(opt)}
                                             disabled={isEvaluating}
                                             className="group w-full p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center gap-4 text-left shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50"
                                           >
                                              <span className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-bold text-xs flex items-center justify-center group-hover:border-blue-200 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors capitalize">
                                                 {String.fromCharCode(65 + i)}.
                                              </span>
                                              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{opt}</span>
                                           </button>
                                         ))}
                                      </div>
                                   )}

                                   {/* Writing Input */}
                                   {(currentTask.skill === 'writing' || useSpeakingFallback) && (
                                     <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                       <textarea
                                         value={textValue}
                                         onChange={(e) => setTextValue(e.target.value)}
                                         placeholder="Type your response here..."
                                         disabled={isEvaluating}
                                         className="w-full min-h-[180px] p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-blue-500 focus:bg-white transition-all outline-none resize-none text-slate-700 font-medium leading-relaxed"
                                       />
                                       <div className="flex justify-between items-center px-1">
                                          {textValue.length > 0 && textValue.length < 5 && (
                                            <span className="text-[10px] font-bold text-amber-500 uppercase">Give us a bit more detail!</span>
                                          )}
                                          <div className="flex-1" />
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Characters: {textValue.length}
                                          </span>
                                       </div>
                                     </div>
                                   )}

                                   {/* Speaking Input */}
                                   {currentTask.skill === 'speaking' && !useSpeakingFallback && (
                                     <div className="py-4 animate-in zoom-in-95 duration-500">
                                        <SpeakingModule 
                                          task={currentTask as any}
                                          isEvaluating={isEvaluating}
                                          feedback={null}
                                          retryCount={0}
                                          onSubmit={(res) => handleNextTask(res.answer, res.responseMode, res.speakingMeta)}
                                        />
                                        <div className="mt-8 flex justify-center">
                                           <button 
                                              onClick={() => setUseSpeakingFallback(true)}
                                              className="text-xs font-bold text-slate-400 hover:text-blue-500 underline underline-offset-4 transition"
                                           >
                                              I can't talk right now (Switch to typing)
                                           </button>
                                        </div>
                                     </div>
                                   )}

                                   {/* Audio for Listening */}
                                   {currentTask.skill === 'listening' && currentTask.audioUrl && (
                                       <div className="max-w-md">
                                          <AudioPlaybackControl audioUrl={currentTask.audioUrl} className="shadow-sm border border-slate-100" />
                                       </div>
                                   )}
                                </div>
                             </div>
                          </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-center">
                        <button 
                           onClick={() => navigate('/dashboard')}
                           className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                        >
                           Cancel
                        </button>
                        <div className="flex items-center gap-3">
                            <button 
                              onClick={handleSkip}
                              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                            >
                               Skip
                            </button>
                             <button 
                                className={`px-10 py-3 rounded-xl font-bold shadow-lg transition active:scale-95 flex items-center gap-2 ${
                                   (textValue.trim().length >= 5 || ['mcq', 'listening', 'mcq_reading', 'reading_mcq', 'listening_mcq', 'fill_blank'].includes(currentTask.type) || ['listening'].includes(currentTask.skill)) && !isEvaluating
                                   ? 'bg-[#1A73E8] text-white shadow-blue-500/20 hover:bg-blue-700'
                                   : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                }`}
                                disabled={isEvaluating || ((currentTask.skill === 'writing' || useSpeakingFallback) && textValue.trim().length < 5) || (currentTask.skill === 'speaking' && !useSpeakingFallback)}
                                onClick={() => {
                                  if (currentTask.skill === 'writing' || useSpeakingFallback) {
                                    handleNextTask(textValue);
                                  }
                                }}
                             >
                                {isEvaluating ? <RefreshingLoader /> : 'Next'}
                             </button>

                        </div>
                    </div>
                </div>
            </section>

            {/* Right: Parallel Progress (Mockup 2 Sidebar) */}
            <section className="w-full lg:w-80 flex flex-col h-full gap-6">
                 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col h-full group hover:shadow-md transition">
                    <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">Parallel Progress</h3>
                    
                    <div className="space-y-10 flex-1">
                        {/* Level Indicator */}
                        <div className="relative">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Estimated Level:</h4>
                            <div className="text-4xl font-black text-slate-900 tracking-tighter">
                                {progress.currentBand}
                            </div>
                        </div>

                        {/* Circular Confidence Gauges (Mockup 2 style) */}
                        <div className="space-y-12">
                            {/* Confidence 1 */}
                            <div className="relative">
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Confidence</h4>
                                <div className="relative w-32 h-32 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                                        <motion.circle 
                                           cx="50" cy="50" r="42" fill="none" 
                                           stroke="#1A73E8" strokeWidth="10" strokeLinecap="round"
                                           initial={{ strokeDasharray: "0 264" }}
                                           animate={{ strokeDasharray: `${progress.confidence * 264} 264` }}
                                           transition={{ duration: 1 }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                                       <span className="text-2xl font-black text-slate-900">{progress.currentBand}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Confidence 2 */}
                            <div className="relative">
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Confidence</h4>
                                <div className="relative w-32 h-32 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                                        <motion.circle 
                                           cx="50" cy="50" r="42" fill="none" 
                                           stroke="#1A73E8" strokeWidth="10" strokeLinecap="round"
                                           initial={{ strokeDasharray: "0 264" }}
                                           animate={{ strokeDasharray: `${Math.min(0.9, progress.confidence + 0.1) * 264} 264` }}
                                           transition={{ duration: 1.2 }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                       <span className="text-2xl font-black text-slate-900">{Math.round(progress.confidence * 100)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 cursor-pointer transition active:rotate-180 duration-500">
                           <RefreshCcw size={18} />
                        </div>
                    </div>
                 </div>
            </section>
        </div>
      </main>
    </div>
  );
};


// ============================================================================
// HELPERS
// ============================================================================

const NavItem = ({ icon, label, active = false, onClick, isDanger = false }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-[13px] transition-all ${
      active 
        ? 'bg-blue-600 text-white border-blue-500 shadow-lg' 
        : isDanger
          ? 'text-rose-400 hover:bg-rose-500/10 border-transparent'
          : 'text-slate-400 border-transparent'
    }`}
  >
    {icon}
    <span className="tracking-wide">{label}</span>
  </button>
);

const LoadingSkeleton = () => (
    <div className="h-screen w-full bg-[#F8FAFC] flex items-center justify-center">
      <div className="relative flex flex-col items-center">
        <div className="w-16 h-16 border-[5px] border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="mt-6 text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
           <RefreshCcw size={14} className="text-blue-500 animate-spin" /> Preparing Assessment Layer...
        </div>
      </div>
    </div>
);

const SyncingView = ({ isSaving, saveError }: any) => (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-center">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-white border border-slate-100 shadow-xl flex items-center justify-center">
           <RefreshCcw className={`w-10 h-10 text-blue-500 ${isSaving ? 'animate-spin' : ''}`} />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
           <CheckCircle2 size={12} className="text-white" />
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">AI Pedagogical Analysis...</h3>
        <p className="text-slate-500 font-medium">Grok-Expert is analyzing your cognitive patterns & level placement.</p>
        <div className="flex flex-col gap-2 mt-4">
           <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest animate-pulse">Running Scorer (Grok-1)</div>
           <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse delay-700">Running Analyst (Grok-2)</div>
        </div>
        {saveError && <p className="text-rose-500 text-sm font-bold mt-4">⚠️ Sync error: {saveError}</p>}
      </div>
    </div>
  </div>
);

const RefreshingLoader = () => (
  <div className="flex items-center gap-2">
    <RefreshCcw size={14} className="animate-spin" />
    <span>Syncing...</span>
  </div>
);

export default DiagnosticView;
