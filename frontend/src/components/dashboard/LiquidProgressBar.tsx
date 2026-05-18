import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Award } from 'lucide-react';
import { AnimatedFlame } from './AnimatedFlame';

interface LiquidProgressBarProps {
    progress: number; // 0 to 100
    levelTitle: string;
    targetLevel: string;
    xpPoints: number;
    streak: number;
}

export const LiquidProgressBar: React.FC<LiquidProgressBarProps> = ({ progress, levelTitle, targetLevel, xpPoints, streak }) => {
    
    const [prevXP, setPrevXP] = useState(xpPoints);
    const [showBonus, setShowBonus] = useState(false);

    useEffect(() => {
        if (xpPoints > prevXP) {
            setShowBonus(true);
            setTimeout(() => setShowBonus(false), 2000);
            setPrevXP(xpPoints);
        }
    }, [xpPoints, prevXP]);

    return (
        <div className="relative w-full max-w-4xl mx-auto p-8 rounded-[40px] bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300">
            
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-r from-cyan-500/[0.04] via-purple-500/[0.04] to-indigo-500/[0.04] dark:from-cyan-500/10 dark:via-purple-500/10 dark:to-indigo-500/10 blur-[100px] pointer-events-none transition-all duration-300" />

            <div className="relative z-10 flex flex-col gap-6">
                
                {/* Header Information */}
                <div className="flex items-end justify-between">
                    <div>
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-cyan-600 dark:text-cyan-400">CEFR Mastery</span>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1 drop-shadow-md">
                            {levelTitle} <span className="text-slate-400 dark:text-slate-500">→</span> <span className="text-purple-600 dark:text-purple-400">{targetLevel}</span>
                        </h3>
                    </div>
                    
                    <div className="relative">
                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-500 to-purple-600 dark:from-cyan-300 dark:to-purple-400">
                            {xpPoints.toLocaleString()} <span className="text-sm text-slate-400 dark:text-slate-500">XP</span>
                        </span>
                        
                        {/* Bonus XP Animation */}
                        <AnimatePresence>
                            {showBonus && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20, scale: 0.5 }}
                                    animate={{ opacity: 1, y: -40, scale: 1.2 }}
                                    exit={{ opacity: 0, y: -80, scale: 1 }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className="absolute -top-4 right-0 flex items-center gap-1 text-amber-500 dark:text-amber-400 font-black drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                                >
                                    <Sparkles size={16} />
                                    <span>+XP</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* The Liquid Bar Container */}
                <div className="relative h-12 w-full bg-slate-100 dark:bg-slate-950/80 rounded-full border border-slate-200 dark:border-white/5 overflow-hidden shadow-inner flex items-center justify-center transition-all duration-300">
                    
                    {/* Dark/Empty state text overlay (under liquid) */}
                    <span className="absolute z-20 text-xs font-black text-slate-500 dark:text-white/50 tracking-widest mix-blend-difference">
                        {progress.toFixed(1)}% MASTERY
                    </span>

                    {/* Liquid Fill */}
                    <motion.div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-purple-600 shadow-[0_0_30px_rgba(168,85,247,0.3)] dark:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        style={{
                            // Create a subtle wave effect at the edge using clip-path
                            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                        }}
                    >
                        {/* Shimmer effect inside the liquid */}
                        <motion.div 
                            className="absolute inset-0 w-[200%] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                    </motion.div>
                </div>

                {/* Sub-Badges row */}
                <div className="flex flex-wrap items-center gap-4 mt-2">
                    {/* Flame Integration */}
                    <div className="flex-shrink-0">
                        <AnimatedFlame streak={streak} state={streak > 0 ? 'active' : 'broken'} />
                    </div>

                    <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-[1.5rem] shadow-inner group transition-all hover:border-blue-500/30">
                        <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform">
                            <Trophy size={20} className="text-white" />
                        </div>
                        <div className="whitespace-nowrap">
                            <p className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-[0.2em] leading-none mb-1">Cognitive XP</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">{xpPoints}</span>
                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Total</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-[1.5rem] shadow-inner group transition-all hover:border-emerald-500/30">
                        <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform">
                            <Award size={20} className="text-white" />
                        </div>
                        <div className="whitespace-nowrap">
                            <p className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-[0.2em] leading-none mb-1">Mastery Rank</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">{levelTitle}</span>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Rank</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
