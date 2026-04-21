import React from 'react';
import { motion } from 'motion/react';
import { 
    ArrowRight, Lock, Layout, ClipboardList, 
    CheckCircle2, Sparkles, Navigation2, BookOpen, Layers
} from 'lucide-react';

interface RoadmapGridCardProps {
    nodes: any[];
    onViewFullJourney: () => void;
    totalNodesCount: number;
    currentIndex: number;
    skillsMatrix: any[];
    dashData: any;
}

export const RoadmapGridCard: React.FC<RoadmapGridCardProps> = ({ 
    nodes, 
    onViewFullJourney, 
    totalNodesCount, 
    currentIndex,
    dashData
}) => {
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
                <div className="px-10 pt-10 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-slate-500 dark:text-white/30">Neural Linguistic Roadmap</span>
                        <div className="flex items-center gap-3">
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
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
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-blue-600/10 hover:bg-slate-200 dark:hover:bg-blue-600/20 border border-slate-200 dark:border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-blue-400 transition-all active:scale-95"
                    >
                        Detailed Analytics <ArrowRight size={14} />
                    </button>
                </div>

                {/* 2. MAIN VISUALIZATION AREA */}
                <div className="relative flex min-h-[440px] px-2 py-4">
                    
                    {/* Lateral Navigation (Internal Hub) */}
                    <div className="w-24 shrink-0 flex flex-col items-center gap-8 pt-16 border-r border-slate-100 dark:border-white/5">
                        {[
                            { icon: <Layout size={18} />, label: 'Path' },
                            { icon: <ClipboardList size={18} />, label: 'Audit' },
                            { icon: <Sparkles size={18} />, label: 'Neural' }
                        ].map((item, idx) => (
                            <div key={idx} className={`flex flex-col items-center gap-2 group/nav cursor-pointer ${idx > 0 ? 'opacity-30' : ''}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                                    ${idx === 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500'}
                                `}>
                                    {item.icon}
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Roadmap Canvas */}
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center px-12">
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
                        <div className="relative z-10 w-full flex justify-between items-center h-full px-16">
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
                                                relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500
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

                                            <span className="text-xl font-black">{level}</span>
                                            
                                            {/* Status Badge */}
                                            <div className={`
                                                absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-[#050510] flex items-center justify-center
                                                ${isCompleted ? 'bg-blue-500 text-white' : isCurrent ? 'bg-blue-400 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                                            `}>
                                                {isCompleted ? <CheckCircle2 size={12} /> : isCurrent ? <Sparkles size={12} /> : <Lock size={12} />}
                                            </div>
                                        </motion.div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. MILESTONE CARDS (Footer) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50 dark:bg-black/40 border-t border-slate-200 dark:border-white/5">
                    {milestones.map((node, i) => {
                        // Data Point Mapping: If index < current (Completed), if index === current (40%)
                        const progress = node.status === 'completed' ? 100 : (node.status === 'active' || node.status === 'current') ? 40 : 0;
                        
                        return (
                            <motion.div 
                                key={node.id || i}
                                className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] shadow-sm relative group/m"
                            >
                                <div className="flex items-start gap-5">
                                    <div className={`p-4 rounded-2xl ${progress > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                                        {i === 0 ? <Layers size={22} /> : <BookOpen size={22} />}
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                    {node.title}
                                                </h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-500 font-medium line-clamp-2">
                                                    {node.description}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-black text-blue-600">{progress}%</span>
                                            </div>
                                        </div>

                                        {/* Progress Bar (mapped to data) */}
                                        <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                                className="h-full bg-blue-600 rounded-full"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-2">
                                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                                                    <Sparkles size={10} /> {node.skill_focus || 'Core'}
                                                </div>
                                            </div>
                                            {progress === 100 && (
                                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500">
                                                    <CheckCircle2 size={10} /> Mastery Achieved
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
