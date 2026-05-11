import React from 'react';
import { motion } from 'motion/react';
import { 
    ArrowRight, Lock, Layout, ClipboardList, 
    CheckCircle2, Sparkles, Navigation2, BookOpen, Layers,
    Headphones, Mic, PenTool, Calendar, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';


interface RoadmapGridCardProps {
    nodes: any[];
    onViewFullJourney: () => void;
    totalNodesCount: number;
    currentIndex: number;
    skillsMatrix: any[];
    dashData: any;
    dailyBites: any;
}

export const RoadmapGridCard: React.FC<RoadmapGridCardProps> = ({ 
    nodes, 
    onViewFullJourney, 
    totalNodesCount, 
    currentIndex,
    dailyBites
}) => {

    const navigate = useNavigate();
    const [activeSubTab, setActiveSubTab] = React.useState<'path' | 'daily'>('path');
    // 1. Static/Dynamic UI Config
    const milestones = nodes.slice(0, 2); 
    
    // 2. Render Helper for Fiber Path (Multi-strand "Fiber Optic" effect)
    const renderFibers = () => {
        // Updated path to better flow across 6 nodes
        const basePath = "M 50 300 C 150 100, 250 400, 350 200 C 450 50, 550 350, 650 150 C 750 0, 850 250, 950 100";
        
        return (
            <>
                {/* Secondary strands for density */}
                <path d={basePath} fill="none" stroke="currentColor" className="text-blue-500/5" strokeWidth="20" strokeLinecap="round" transform="translate(0, 5)" />
                <path d={basePath} fill="none" stroke="currentColor" className="text-blue-500/5" strokeWidth="15" strokeLinecap="round" transform="translate(2, -3)" />
                
                {/* Core animated strands */}
                {[0, 2, -2].map((offset, idx) => (
                    <motion.path 
                        key={idx}
                        d={basePath} 
                        fill="none" 
                        stroke={idx === 0 ? "url(#fiberGradient)" : "rgba(59, 130, 246, 0.2)"}
                        strokeWidth={idx === 0 ? "3" : "1"} 
                        strokeLinecap="round"
                        transform={`translate(0, ${offset})`}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.8 }}
                        transition={{ duration: 2.5, ease: "easeInOut", delay: idx * 0.1 }}
                    />
                ))}

                {/* Pulsing Atmosphere (Dark Mode) */}
                <motion.path 
                    d={basePath} 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    className="hidden dark:block opacity-10"
                    animate={{ opacity: [0.05, 0.15, 0.05] }}
                    transition={{ duration: 4, repeat: Infinity }}
                />
            </>
        );
    };

    // 3. Node Positioning Logic (to match the winding path)
    const yOffsets = [120, 60, 110, 40, 95, 55]; 

    return (
        <div className="col-span-12 w-full">
            {/* --- PRIMARY CONTAINER --- */}
            <div className={`
                relative group border rounded-[2.5rem] overflow-hidden transition-all duration-500
                bg-[#F8FAFC] border-slate-200 shadow-[0_2px_10px_0_rgba(148,163,184,0.1)]
                dark:bg-[#050510] dark:border-white/5 dark:shadow-[0_0_15px_rgba(59,130,246,0.2)]
                hover:translate-y-[-4px]
            `}>
                
                {/* 1. TOP HEADER */}
                <div className="px-6 md:px-10 pt-8 md:pt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-500 dark:text-white/30">Neural Linguistic Roadmap</span>
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                                Proficiency <span className="text-blue-600 dark:text-blue-500">Journey</span>
                            </h3>
                            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 rounded-full">
                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                    Current Tier: {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'][currentIndex] || 'B2'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onViewFullJourney}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-blue-600/10 hover:bg-slate-200 dark:hover:bg-blue-600/20 border border-slate-200 dark:border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-blue-400 transition-all active:scale-95"
                    >
                        Detailed Analytics <ArrowRight size={14} />
                    </button>
                </div>

                {/* 2. MAIN VISUALIZATION AREA */}
                <div className="relative flex flex-col lg:flex-row lg:min-h-[440px] px-0 lg:px-2 py-4">
                    
                    {/* Lateral Navigation (Internal Hub) - Hidden on Mobile */}
                    <div className="hidden lg:flex w-24 shrink-0 flex-col items-center gap-8 pt-16 border-r border-slate-100 dark:border-white/5">
                        {[
                            { id: 'path', icon: <Layout size={18} />, label: 'Path' },
                            { id: 'daily', icon: <Calendar size={18} />, label: 'Daily' }
                        ].map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => setActiveSubTab(item.id as any)}
                                className={`flex flex-col items-center gap-2 group/nav cursor-pointer transition-all duration-300 ${activeSubTab !== item.id ? 'opacity-30 hover:opacity-60' : ''}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                                    ${activeSubTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500'}
                                `}>
                                    {item.icon}
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Roadmap Canvas or Daily Practice */}
                    <div className="flex-1 relative overflow-x-auto lg:overflow-hidden flex items-center justify-start lg:justify-center px-0 lg:px-12 scrollbar-hide py-12 lg:py-0">
                        {activeSubTab === 'path' ? (
                            <div className="min-w-[850px] lg:min-w-0 w-full relative flex items-center justify-center h-[300px] lg:h-full px-12">
                                <svg className="absolute inset-0 w-full h-full opacity-60 dark:opacity-100" viewBox="0 0 1000 400" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="fiberGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.1" />
                                            <stop offset="50%" stopColor="#60a5fa" stopOpacity="1" />
                                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
                                        </linearGradient>
                                    </defs>
                                    {renderFibers()}
                                </svg>

                                {/* Stations Overlay */}
                                <div className="relative z-10 w-full flex justify-between items-center h-full px-8 md:px-16">
                                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level, i) => {
                                        const isCurrent = i === currentIndex;
                                        const isCompleted = i < currentIndex;
                                        return (
                                            <div key={level} className="relative group/node" style={{ transform: `translateY(${yOffsets[i] - 100}px)` }}>
                                                {/* Status Tag */}
                                                {isCurrent && (
                                                    <motion.div 
                                                        initial={{ y: 10, opacity: 0 }}
                                                        animate={{ y: 0, opacity: 1 }}
                                                        className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                                    >
                                                        <div className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                                                            <Navigation2 size={10} className="rotate-45" /> Active Station
                                                        </div>
                                                        <div className="w-0.5 h-4 bg-blue-600/50" />
                                                    </motion.div>
                                                )}

                                                {/* The Node */}
                                                <motion.div 
                                                    whileHover={{ scale: 1.1 }}
                                                    className={`
                                                        relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-500
                                                        ${(isCurrent || isCompleted)
                                                            ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] z-20 overflow-visible' 
                                                            : 'bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 text-slate-400'
                                                        }
                                                    `}
                                                >
                                                    {/* Pulsing Aura (B2 / Current) */}
                                                    {isCurrent && (
                                                        <motion.div 
                                                            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                            className="absolute inset-[-10px] rounded-full border-2 border-blue-500/30"
                                                        />
                                                    )}

                                                    <span className="text-lg md:text-xl font-black">{level}</span>
                                                    
                                                    {/* Status Badge */}
                                                    <div className={`
                                                        absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-white dark:border-[#050510] flex items-center justify-center
                                                        ${isCompleted ? 'bg-blue-500 text-white' : isCurrent ? 'bg-blue-400 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                                                    `}>
                                                        {isCompleted ? <CheckCircle2 size={10} md:size={12} /> : isCurrent ? <Sparkles size={10} md:size={12} /> : <Lock size={10} md:size={12} />}
                                                    </div>
                                                </motion.div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                                ) : (
                                    <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar max-h-[700px]">
                                        {/* Daily Cycle Synchronization Header */}
                                        <div className="flex items-center justify-between px-6 py-4 bg-blue-500/5 border border-blue-500/10 rounded-3xl mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Neural Cycle Synchronized</span>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/50 rounded-full border border-white/5">
                                                <Zap size={10} className="text-blue-400" />
                                                <span className="text-[10px] font-black text-blue-400 font-mono">Next update in: 05h 08m</span>
                                            </div>
                                        </div>

                                        {!dailyBites ? (

                                    <div className="p-12 rounded-[40px] bg-slate-900/50 border border-white/5 flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="p-4 rounded-full bg-indigo-500/10 animate-pulse">
                                            <Sparkles className="text-indigo-400" size={32} />
                                        </div>
                                        <h3 className="text-xl font-black text-white">Neural Engine Synchronizing...</h3>
                                        <p className="text-slate-400 text-sm max-w-xs">We are architecting your synchronized daily learning bites.</p>
                                    </div>
                                ) : (
                                    <div className="relative py-10 min-h-[600px]">
                                        {/* Winding Connector Path */}
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                                            <path 
                                                d="M 50% 0 C 80% 150, 20% 300, 50% 450 C 80% 600, 20% 750, 50% 900" 
                                                fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 8" 
                                                className="text-blue-500"
                                            />
                                        </svg>

                                        <div className="space-y-16 relative z-10">
                                            {[
                                                { title: 'Vocabulary', sub: 'Linguistic Seed', icon: <Sparkles size={18} />, content: dailyBites.vocabulary, colorClass: 'indigo', textClass: 'text-indigo-500', borderClass: 'border-indigo-500/30', bgClass: 'bg-indigo-500', align: 'left' },
                                                { title: 'Grammar', sub: 'Neural Repair', icon: <Zap size={18} />, content: dailyBites.grammar, colorClass: 'rose', textClass: 'text-rose-500', borderClass: 'border-rose-500/30', bgClass: 'bg-rose-500', align: 'right' },
                                                { title: 'Style', sub: 'Tone Transformer', icon: <PenTool size={18} />, content: dailyBites.style, colorClass: 'blue', textClass: 'text-blue-500', borderClass: 'border-blue-500/30', bgClass: 'bg-blue-500', align: 'left' },
                                                { title: 'Punctuation', sub: 'Structural Logic', icon: <Layers size={18} />, content: dailyBites.punctuation, colorClass: 'emerald', textClass: 'text-emerald-500', borderClass: 'border-emerald-500/30', bgClass: 'bg-emerald-500', align: 'right' }
                                            ].map((bite, i) => (
                                                <motion.div 
                                                    key={i} 
                                                    initial={{ opacity: 0, x: bite.align === 'left' ? -20 : 20 }}
                                                    whileInView={{ opacity: 1, x: 0 }}
                                                    className={`flex items-center gap-6 ${bite.align === 'right' ? 'flex-row-reverse' : ''}`}
                                                >
                                                    {/* The Node (Neural Pulse) */}
                                                    <div className="relative shrink-0">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border border-${bite.colorClass}-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-110 transition-transform relative z-20`}>
                                                            <div className={bite.textClass}>{bite.icon}</div>
                                                        </div>
                                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${bite.bgClass} flex items-center justify-center text-[7px] font-black text-white shadow-lg z-30`}>
                                                            0{i+1}
                                                        </div>
                                                    </div>

                                                    {/* Full-Fidelity Premium Card */}
                                                    <div className={`flex-1 p-8 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-black/40 border border-slate-200 ${bite.colorClass === 'indigo' ? 'dark:border-indigo-500/20 hover:border-indigo-500/40' : bite.colorClass === 'rose' ? 'dark:border-rose-500/20 hover:border-rose-500/40' : bite.colorClass === 'blue' ? 'dark:border-blue-500/20 hover:border-blue-500/40' : 'dark:border-emerald-500/20 hover:border-emerald-500/40'} shadow-premium transition-all relative overflow-hidden`}>
                                                        {/* Glow Background Accent */}
                                                        <div className={`absolute -top-10 -right-10 w-32 h-32 ${bite.bgClass} opacity-[0.03] blur-3xl pointer-events-none`} />
                                                        
                                                        <div className="relative z-10">
                                                            <div className="flex items-center justify-between mb-6">
                                                                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">{bite.title}</h4>
                                                                <span className="text-[10px] font-bold text-slate-500 italic opacity-50">{bite.sub}</span>
                                                            </div>

                                                            {/* Dynamic High-Fidelity Content - Synced with Architect Prompt */}
                                                            <div className="w-full">
                                                                {/* 1. Vocabulary: Progression & Insight */}
                                                                {(i === 0 && (bite.content?.progression || bite.content?.steps || bite.content?.seed_word)) ? (
                                                                    <div className="space-y-6">
                                                                        <div className="flex items-center justify-between px-4">
                                                                            {(bite.content.progression || bite.content.steps || ['A1', 'B2', bite.content.seed_word || 'Deploy']).map((item: any, idx: number) => {
                                                                                const word = typeof item === 'string' ? item : item.word;
                                                                                const level = typeof item === 'string' ? ['A1/A2', 'B2', 'C1/C2'][idx] : item.level;
                                                                                return (
                                                                                    <div 
                                                                                        key={idx} 
                                                                                        onClick={() => {
                                                                                            const utterance = new SpeechSynthesisUtterance(word);
                                                                                            utterance.lang = 'en-US';
                                                                                            window.speechSynthesis.speak(utterance);
                                                                                        }}
                                                                                        className="flex flex-col items-center cursor-pointer group/word"
                                                                                    >
                                                                                        <span className="text-[8px] font-black text-slate-500 uppercase mb-2">{level}</span>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className={`text-sm sm:text-base font-black transition-all ${idx === 2 ? 'text-blue-400 text-lg group-hover/word:text-blue-300' : 'text-slate-500 opacity-40 group-hover/word:opacity-100'}`}>
                                                                                                {word}
                                                                                            </span>
                                                                                            <Headphones size={10} className={`opacity-0 group-hover/word:opacity-100 transition-opacity ${idx === 2 ? 'text-blue-400' : 'text-slate-500'}`} />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400 font-medium italic border-t border-white/5 pt-4 text-center leading-relaxed">
                                                                            {bite.content.technical_insight || bite.content.definition || bite.content.context_note}
                                                                        </p>
                                                                    </div>
                                                                ) : i === 1 && (bite.content?.correction || bite.content?.fallacy || bite.content?.correct || bite.content?.incorrect) ? (
                                                                    /* 2. Grammar: Fallacy vs Correction */
                                                                    <div className="space-y-4">
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                                                                                <span className="text-[8px] font-black text-rose-400 uppercase block mb-1">Common Fallacy</span>
                                                                                <p className="text-xs font-bold text-slate-300">
                                                                                    {(!bite.content.fallacy || bite.content.fallacy === '[SKIPPED]') 
                                                                                        ? "The model is doing good on the test set." 
                                                                                        : bite.content.fallacy}
                                                                                </p>
                                                                            </div>
                                                                            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                                                                <span className="text-[8px] font-black text-emerald-400 uppercase block mb-1">Neural Correction</span>
                                                                                <p className="text-xs font-bold text-slate-300">
                                                                                    {(!bite.content.correction || bite.content.correction === '[SKIPPED]') 
                                                                                        ? "The model is performing well on the test set." 
                                                                                        : bite.content.correction}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 italic pl-2 border-l border-white/10">
                                                                            <Zap size={10} className="text-blue-400" /> 
                                                                            {(!bite.content.neural_logic || bite.content.neural_logic === '[SKIPPED]')
                                                                                ? "Adverbs vs. Adjectives: 'Well' describes the performance (verb), not the model."
                                                                                : (bite.content.neural_logic || bite.content.rule)}
                                                                        </div>

                                                                    </div>

                                                                ) : (
                                                                    /* 3 & 4. Style & Punctuation */
                                                                    <div className="space-y-4">
                                                                        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                                                            <span className="text-[8px] font-black text-blue-400 uppercase block mb-1">
                                                                                {i === 2 ? 'Professional Transformation' : 'Structural Example'}
                                                                            </span>
                                                                            <p className="text-[11px] text-slate-200 font-bold leading-relaxed">
                                                                                {(bite.content?.transformed_sentence && bite.content?.transformed_sentence !== '[SKIPPED]') 
                                                                                    ? bite.content.transformed_sentence 
                                                                                    : i === 2 
                                                                                        ? "The efficacy of the AI model is noteworthy, particularly in its ability to generalize from heterogeneous datasets."
                                                                                        : (bite.content?.example || "The deployment failed due to a critical bottleneck: insufficient GPU VRAM for the transformer's heads.")}
                                                                            </p>
                                                                        </div>

                                                                        <div className={`p-4 rounded-2xl ${bite.colorClass === 'blue' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-emerald-500/5 border-emerald-500/10'} italic text-[10px] text-slate-400 leading-relaxed`}>
                                                                            <span className="font-black uppercase text-[8px] block mb-1 opacity-50">Deep Dive Analysis</span>
                                                                            {(!bite.content?.style_analysis && !bite.content?.logic_note) || bite.content?.style_analysis === '[SKIPPED]'
                                                                                ? i === 2
                                                                                    ? "Lexical Density: Replacing 'very good' with 'efficacy' and 'learn' with 'generalize' elevates the tone for a technical audience."
                                                                                    : "The Colon acts as an 'Equal Sign', introducing the exact explanation for the preceding logical thought."
                                                                                : (bite.content?.style_analysis || bite.content?.logic_note || bite.content?.rule_usage)}
                                                                        </div>
                                                                    </div>

                                                                )}
                                                            </div>

                                                        </div>
                                                    </div>



                                                </motion.div>
                                            ))}

                                        </div>
                                    </div>
                                )}
                            </div>
                        )}


                    </div>
                </div>

                {/* 3. MILESTONE CARDS (Footer) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-6 md:p-10 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5">
                    {milestones.map((node, i) => {
                        // Data Point Mapping: If index < current (Completed), if index === current (40%)
                        const progress = node.status === 'completed' ? 100 : (node.status === 'active' || node.status === 'current') ? 40 : 0;
                        
                        return (
                            <motion.div 
                                key={node.id || i}
                                className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 p-5 md:p-6 rounded-[2rem] shadow-sm relative group/m"
                            >
                                <div className="flex items-start gap-4 md:gap-5">
                                    <div className={`p-3 md:p-4 rounded-2xl ${progress > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                                        {i === 0 ? <Layers size={18} md:size={22} /> : <BookOpen size={18} md:size={22} />}
                                    </div>
                                    <div className="flex-1 space-y-3 md:space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h4 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                    {node.title}
                                                </h4>
                                                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-500 font-medium line-clamp-2">
                                                    {node.description}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs md:text-sm font-black text-blue-600">{progress}%</span>
                                            </div>
                                        </div>

                                        {/* Progress Bar (mapped to data) */}
                                        <div className="h-1.5 md:h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                                className="h-full bg-blue-600 rounded-full"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-2">
                                                <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-black uppercase text-slate-400">
                                                    <Sparkles size={8} md:size={10} /> {node.skill_focus || 'Core'}
                                                </div>
                                            </div>
                                            {progress === 100 && (
                                                <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-black uppercase text-emerald-500">
                                                    <CheckCircle2 size={8} md:size={10} /> Mastery Achieved
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
