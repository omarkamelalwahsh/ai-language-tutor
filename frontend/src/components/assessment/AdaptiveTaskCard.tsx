import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Send, ArrowRight, RefreshCcw, CheckCircle2, Sparkles, Brain, Volume2 } from 'lucide-react';
import { assessmentService, TaskEvaluationResponse } from '../../services/assessmentService';

export interface TaskData {
  task_metadata: {
    id: string;
    type: string;
    difficulty_score: number;
    skill_tag: string;
  };
  content: {
    instruction: string;
    stimulus: string;
    target: string;
    fragments?: string[];
    masked_sentence?: string;
    options?: string[];
    hint?: string;
    explanation: string;
  };
}

interface AdaptiveTaskCardProps {
  userId: string;
  initialTaskData?: TaskData;
  onComplete?: (result: TaskEvaluationResponse) => void;
}

const cardVariants = {
  initial: { scale: 0.95, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 1.05, opacity: 0, y: -20 },
  success: { 
    boxShadow: "0px 0px 40px rgba(16, 185, 129, 0.2)", 
    borderColor: "rgba(16, 185, 129, 0.5)",
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },
  error: { 
    x: [-2, 2, -2, 2, 0], 
    borderColor: "rgba(244, 63, 94, 0.5)",
    boxShadow: "0px 0px 40px rgba(244, 63, 94, 0.1)",
    transition: { duration: 0.4 }
  }
};

const AdaptiveTaskCard: React.FC<AdaptiveTaskCardProps> = ({
  userId,
  initialTaskData,
  onComplete
}) => {
  const [task, setTask] = useState<TaskData | null>(initialTaskData || null);
  const [response, setResponse] = useState('');
  const [selectedFragments, setSelectedFragments] = useState<{id: number, text: string}[]>([]);
  const [availableFragments, setAvailableFragments] = useState<{id: number, text: string}[]>([]);
  const [isLoading, setIsLoading] = useState(!initialTaskData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<TaskEvaluationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize fragments when task loads
  useEffect(() => {
    if (task && task.content.fragments) {
      setAvailableFragments(task.content.fragments.map((f, i) => ({ id: i, text: f })));
      setSelectedFragments([]);
      setResponse('');
    }
  }, [task]);

  const fetchTask = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const types = ['WORD_BUILDER', 'SCRAMBLED_SENTENCE'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const data = await assessmentService.generateDynamicTask(randomType);
      setTask(data);
    } catch (err) {
      console.error('Failed to fetch task:', err);
      setError('Failed to reach AI Architect. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFragment = (frag: {id: number, text: string}) => {
    setSelectedFragments([...selectedFragments, frag]);
    setAvailableFragments(availableFragments.filter(f => f.id !== frag.id));
  };

  const handleRemoveFragment = (frag: {id: number, text: string}) => {
    setAvailableFragments([...availableFragments, frag]);
    setSelectedFragments(selectedFragments.filter(f => f.id !== frag.id));
  };

  const clearFragments = () => {
    if (task) {
      setAvailableFragments(task.content.fragments.map((f, i) => ({ id: i, text: f })));
      setSelectedFragments([]);
      setResponse('');
    }
  };

  useEffect(() => {
    if (task) {
      const separator = task.task_metadata.type === 'SCRAMBLED_SENTENCE' ? ' ' : '';
      setResponse(selectedFragments.map(f => f.text).join(separator));
    }
  }, [selectedFragments, task]);

  const playAudio = () => {
    if (!task) return;
    const utterance = new SpeechSynthesisUtterance(task.content.stimulus);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const handleOptionSelect = (option: string) => {
    setResponse(option);
  };

  const handleSubmit = async () => {
    if (!response.trim()) return;

    setIsSubmitting(true);
    try {
      const evaluation = await assessmentService.submitDynamicTask(
        userId, 
        task?.task_metadata.id || 'dynamic', 
        response
      );
      setResult(evaluation);
    } catch (error) {
      console.error("Submission failed", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetTask = () => {
    setResult(null);
    setResponse('');
    setSelectedFragments([]);
    fetchTask();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Architecting your task...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-8 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 backdrop-blur-xl text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <p className="text-rose-400 font-bold mb-4">{error}</p>
        <button onClick={fetchTask} className="px-8 py-3 bg-white/10 text-white rounded-xl font-bold">Retry Connection</button>
      </div>
    );
  }

  const isFragmentType = task.task_metadata.type === 'WORD_BUILDER' || task.task_metadata.type === 'SCRAMBLED_SENTENCE';

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      {/* 2. XP Bar / Difficulty Progress */}
      <div className="mb-6 px-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Current Difficulty</span>
          <span className="text-xs font-bold text-white/40">{(task.task_metadata.difficulty_score * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${task.task_metadata.difficulty_score * 100}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="answering"
            variants={cardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="backdrop-blur-3xl bg-[#0f172a]/60 border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-hidden relative"
          >
            {/* Task Header */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                    <Brain className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">
                      {task.task_metadata.type.replace('_', ' ')}
                    </h3>
                    <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-black">
                      {task.task_metadata.skill_tag} • Generative v3
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                   <Sparkles size={12} className="text-amber-400" />
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Production Grade</span>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-[2rem] p-8 mb-8 border border-white/5 shadow-inner relative group">
                <div className="absolute top-4 right-4 opacity-10">
                  <Send size={24} className="text-white" />
                </div>
                <p className="text-indigo-200/40 text-[10px] uppercase tracking-[0.2em] mb-4 font-black">Scenario Context</p>
                <p className="text-white/90 text-xl leading-relaxed font-medium italic">
                  "{task.content.stimulus}"
                </p>
                <div className="mt-8 pt-8 border-t border-white/5">
                  <p className="text-indigo-200/40 text-[10px] uppercase tracking-[0.2em] mb-4 font-black">Linguistic Goal</p>
                  <p className="text-white font-black text-2xl tracking-tight leading-tight">
                    {task.content.instruction}
                  </p>
                </div>
              </div>

              {/* Dynamic UI based on task type */}
              {isFragmentType ? (
                <div className="space-y-10">
                  {/* Drop Zone Area (Selected Fragments) */}
                  <div className="min-h-[100px] w-full bg-black/40 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-wrap gap-3 p-6 items-center justify-center transition-all">
                    {selectedFragments.length === 0 ? (
                      <span className="text-white/10 italic font-medium">Click to arrange elements...</span>
                    ) : (
                      selectedFragments.map((f, i) => (
                        <motion.button
                          layoutId={`frag-${f.id}`}
                          key={f.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          onClick={() => handleRemoveFragment(f)}
                          className="px-5 py-2.5 bg-indigo-600 text-white font-black rounded-xl shadow-xl shadow-indigo-500/30 text-lg hover:bg-indigo-500 transition-colors"
                        >
                          {f.text}
                        </motion.button>
                      ))
                    )}
                  </div>

                  {/* Options Area (Available Fragments) */}
                  <div className="flex flex-wrap gap-4 justify-center">
                    {availableFragments.map((frag) => (
                      <motion.button
                        layoutId={`frag-${frag.id}`}
                        key={frag.id}
                        whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSelectFragment(frag)}
                        className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-lg transition-colors"
                      >
                        {frag.text}
                      </motion.button>
                    ))}
                  </div>
                  
                  <button 
                    onClick={clearFragments}
                    className="text-white/20 hover:text-white/50 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mx-auto mt-6 transition-colors"
                  >
                    <RefreshCcw size={12} /> Reset Arrangement
                  </button>
                </div>
              ) : task.task_metadata.type === 'AUDIO_CHOICE' ? (
                <div className="space-y-8">
                  {/* Audio Controls */}
                  <div className="flex flex-col items-center gap-6 py-10 bg-indigo-500/5 rounded-[2.5rem] border border-indigo-500/10">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={playAudio}
                      className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/40 hover:bg-indigo-500 transition-colors"
                    >
                      <Volume2 className="w-10 h-10 text-white" />
                    </motion.button>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Click to Hear the Context</p>
                  </div>

                  {/* Masked Sentence Context */}
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 text-center">
                    <p className="text-white/80 text-2xl font-bold leading-relaxed tracking-tight italic">
                      "{task.content.masked_sentence}"
                    </p>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {task.content.options?.map((opt, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleOptionSelect(opt)}
                        className={`p-6 rounded-2xl font-black text-xl border-2 transition-all text-center ${
                          response === opt 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-500/20' 
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Your linguistic response..."
                  className="w-full h-56 bg-black/40 border border-white/10 rounded-[2.5rem] p-8 text-white placeholder-white/10 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all resize-none text-xl font-medium"
                />
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (isFragmentType ? selectedFragments.length === 0 : !response.trim())}
                className={`mt-10 w-full py-6 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 transition-all ${
                  isSubmitting 
                    ? 'bg-white/10 text-white/30 cursor-not-allowed' 
                    : 'bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white shadow-2xl shadow-indigo-500/30 active:scale-[0.97]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCcw className="w-7 h-7 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  <>
                    Finalize Answer
                    <ArrowRight className="w-7 h-7" />
                  </>
                )}
              </button>
            </div>
            
            {/* Background Accents */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 blur-[150px] rounded-full" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/5 blur-[150px] rounded-full" />
          </motion.div>
        ) : (
          <motion.div
            key="result"
            variants={cardVariants}
            initial="initial"
            animate={result.is_correct ? "success" : "error"}
            className={`backdrop-blur-3xl bg-[#0f172a]/90 border-2 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden transition-colors duration-500`}
          >
            <div className="relative z-10">
              {/* Result Header */}
              <div className="flex justify-between items-start mb-12">
                <div className="flex items-center gap-6">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`p-5 rounded-3xl ${result.is_correct ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}
                  >
                    {result.is_correct ? (
                      <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-12 h-12 text-rose-400" />
                    )}
                  </motion.div>
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter">
                      {result.is_correct ? 'Masterfully Done!' : 'Foundational Gap'}
                    </h2>
                    <p className="text-white/40 font-black uppercase tracking-widest text-[10px] mt-2">Proficiency Audit Complete</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-6xl font-black tracking-tighter ${result.is_correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.score}
                    <span className="text-2xl ml-1 opacity-30">%</span>
                  </div>
                </div>
              </div>

              {/* AI Feedback & Rule Explanation */}
              <div className="space-y-8 mb-12">
                <div className="bg-white/5 rounded-[2.5rem] p-10 border border-white/5 relative group overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                    <Sparkles size={80} className="text-white" />
                  </div>
                  <p className="text-indigo-400/60 text-[10px] uppercase tracking-[0.2em] mb-4 font-black">AI Linguistic Feedback</p>
                  <p className="text-white/90 text-2xl leading-relaxed font-bold">
                    {result.detailed_feedback}
                  </p>
                </div>

                {task.content.explanation && (
                   <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-8 py-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 flex gap-4"
                   >
                      <div className="mt-1">
                        <Brain size={20} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-2">Pedagogical Anchor</p>
                        <p className="text-indigo-100/70 text-lg italic leading-relaxed">
                          {task.content.explanation}
                        </p>
                      </div>
                   </motion.div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-5">
                  <button 
                    onClick={() => {
                      if (onComplete) onComplete(result);
                    }} 
                    className="flex-[2] bg-white text-black hover:bg-slate-100 font-black py-6 rounded-[2rem] transition-all shadow-2xl shadow-white/5 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    Sync & Continue Journey
                    <ArrowRight size={24} />
                  </button>
                  <button
                    onClick={resetTask}
                    className="flex-1 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[2rem] text-white font-black transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    <RefreshCcw className="w-5 h-5" />
                    New Seed
                  </button>
              </div>
            </div>

            {/* Background Accents */}
            <div className={`absolute -bottom-40 -left-40 w-[30rem] h-[30rem] blur-[150px] rounded-full transition-colors duration-1000 ${
              result.is_correct ? 'bg-emerald-600/20' : 'bg-rose-600/20'
            }`} />
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 blur-[120px] rounded-full" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Loader placeholder helper
const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default AdaptiveTaskCard;
