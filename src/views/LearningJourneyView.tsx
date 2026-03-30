import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Compass, Zap, ArrowRight, PlayCircle, BookOpen, 
  Layers, ShieldCheck, Star, Mic, PenTool, Headphones, 
  Lock, CheckCircle2, ChevronRight
} from 'lucide-react';
import { LearnerModelSnapshot } from '../types/learner-model';
import { JourneyService } from '../services/JourneyService';
import { JourneyNode } from '../types/dashboard';

interface LearningJourneyViewProps {
  model: LearnerModelSnapshot;
  onStartSession: () => void;
  onViewDashboard: () => void;
}

const iconMap = {
  speaking: <Mic className="w-5 h-5" />,
  writing: <PenTool className="w-5 h-5" />,
  listening: <Headphones className="w-5 h-5" />,
  vocabulary: <BookOpen className="w-5 h-5" />,
  grammar: <Layers className="w-5 h-5" />,
  assessment: <ShieldCheck className="w-5 h-5" />,
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export const LearningJourneyView: React.FC<LearningJourneyViewProps> = ({ model, onStartSession, onViewDashboard }) => {
  const journey = useMemo(() => JourneyService.buildJourney(model.overallLevel), [model.overallLevel]);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-indigo-500/30 font-sans text-slate-900 flex flex-col items-center">
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="w-full max-w-4xl space-y-12">
        
        {/* Header */}
        <motion.div variants={staggerItem} className="text-center space-y-4 pt-6">
          <div className="inline-flex items-center gap-2 bg-indigo-100/50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold border border-indigo-200">
            <Compass className="w-4 h-4" /> Curriculum Map
          </div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900">{journey.journeyTitle}</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto font-medium">
            Your personalized path to fluency, broken down into manageable task-based steps and adaptive checkpoints.
          </p>
        </motion.div>

        {/* Global Progress Overview */}
        <motion.div variants={staggerItem} className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">Starting Point</span>
              <span className="text-5xl font-black text-slate-900">{journey.currentStage}</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center w-full">
              <div className="flex justify-between w-full mb-4 px-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Progress to {journey.targetStage}</span>
                 <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">25% Complete</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex items-center shadow-inner relative border border-slate-200">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '25%' }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full relative"
                >
                  <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-20" />
                </motion.div>
              </div>
            </div>
            
            <div className="text-center md:text-right">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">Target Goal</span>
              <span className="text-5xl font-black text-indigo-600">{journey.targetStage}</span>
            </div>
          </div>
        </motion.div>

        {/* The Zigzag Map */}
        <motion.div variants={staggerItem} className="relative py-12 px-4 sm:px-20 min-h-[800px]">
          {/* Background Path Line (SVG) */}
          <div className="absolute inset-0 pointer-events-none hidden sm:block overflow-visible">
            <svg className="w-full h-full overflow-visible" xmlns="http://www.w3.org/2000/svg">
              <defs>
                 <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="20%" stopColor="#4F46E5" />
                    <stop offset="30%" stopColor="#E2E8F0" />
                    <stop offset="100%" stopColor="#E2E8F0" />
                 </linearGradient>
              </defs>
              <path 
                d={generateZigzagPath(journey.nodes.length)} 
                fill="none" 
                stroke="url(#pathGradient)" 
                strokeWidth="8" 
                strokeDasharray="1, 15"
                strokeLinecap="round"
                className="opacity-40"
              />
            </svg>
          </div>

          {/* Nodes */}
          <div className="flex flex-col items-center gap-12 relative z-10">
            {journey.nodes.map((node, i) => (
              <JourneyNodeComponent 
                key={node.id} 
                node={node} 
                index={i} 
                onStartSession={onStartSession}
              />
            ))}
          </div>
        </motion.div>

        {/* Footer CTAs */}
        <motion.div variants={staggerItem} className="pt-8 flex flex-col sm:flex-row gap-5 pb-20 w-full sm:w-auto mx-auto justify-center">
          <button 
            onClick={onStartSession}
            className="group flex flex-1 sm:flex-none items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white px-12 py-5 rounded-3xl font-bold text-xl transition-all duration-300 shadow-2xl active:scale-95"
          >
            Launch Current Task
            <PlayCircle className="w-7 h-7 group-hover:scale-110 transition-transform" />
          </button>
          
          <button 
            onClick={onViewDashboard}
            className="flex flex-1 sm:flex-none items-center justify-center gap-3 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 px-8 py-5 rounded-3xl font-bold text-lg transition-all duration-300 active:scale-95"
          >
            Dashboard
          </button>
        </motion.div>
        
      </motion.div>
    </div>
  );
};

// Node Component for the Journey Map
const JourneyNodeComponent: React.FC<{ node: JourneyNode; index: number; onStartSession: () => void }> = ({ node, index, onStartSession }) => {
  const isLeft = index % 2 === 1;
  const isCheckpoint = node.type === 'checkpoint';
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className={`flex items-center w-full max-w-lg ${isLeft ? 'flex-row-reverse sm:translate-x-24' : 'flex-row sm:-translate-x-24'}`}
    >
      {/* The Node Bubble */}
      <div className="relative group cursor-pointer" onClick={() => node.status === 'current' && onStartSession()}>
        {/* Connection Tooltip */}
        <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl pointer-events-none z-50
          ${isLeft ? 'right-full mr-6' : 'left-full ml-6'}`}>
          {node.title} • {node.status.toUpperCase()}
          {isCheckpoint && " (Mini-Assessment Loop)"}
        </div>

        {/* Outer Glow for Current node */}
        {node.status === 'current' && (
          <motion.div 
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute inset-0 rounded-full ${isCheckpoint ? 'bg-amber-400' : 'bg-indigo-400'}`}
          />
        )}

        <div className={`
          flex items-center justify-center transition-all duration-300 relative border-4
          ${isCheckpoint 
            ? 'w-24 h-24 rounded-[2rem] rotate-[45deg] bg-amber-500 border-amber-200 text-white shadow-xl shadow-amber-200 group-hover:rotate-[0deg]' 
            : 'w-20 h-20 rounded-full bg-white text-slate-400 border-slate-100 shadow-sm'}
          ${node.status === 'completed' && 'bg-indigo-600 border-indigo-200 text-white shadow-lg shadow-indigo-100'}
          ${node.status === 'current' && !isCheckpoint && 'bg-indigo-600 border-indigo-200 text-white shadow-xl shadow-indigo-200 scale-110'}
          ${node.status === 'locked' && 'opacity-60 saturate-50'}
        `}>
          <div className={isCheckpoint ? '-rotate-[45deg] group-hover:rotate-[0deg] transition-transform' : ''}>
            {node.status === 'locked' ? <Lock className="w-6 h-6" /> : (iconMap[node.iconType as keyof typeof iconMap] || <Star />)}
          </div>
        </div>

        {/* Small floating "Current" tag */}
        {node.status === 'current' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap">
            Current Task
          </div>
        )}
      </div>

      {/* Info Content beside the node */}
      <div className={`hidden sm:block flex-1 px-8 ${isLeft ? 'text-right' : 'text-left'}`}>
        <h4 className={`text-lg font-bold mb-1 ${node.status === 'locked' ? 'text-slate-400' : 'text-slate-900 font-black'}`}>
          {node.title}
        </h4>
        <p className={`text-sm leading-relaxed ${node.status === 'locked' ? 'text-slate-300' : 'text-slate-500 font-medium'}`}>
          {node.description}
        </p>
      </div>
    </motion.div>
  );
};

// Utility to generate a SVG path string for the zigzag
function generateZigzagPath(count: number) {
  const nodeHeight = 80 + 48; // Node size + Gap (matching the items-center gap-12)
  const width = 48; // Horizontal offset
  let path = `M ${400} 0`; // Start at top center
  
  for (let i = 0; i < count; i++) {
    const isLeft = i % 2 === 1;
    const x = 400 + (isLeft ? width : -width);
    const y = i * nodeHeight + 40;
    path += ` L ${x} ${y}`;
  }
  return path;
}
