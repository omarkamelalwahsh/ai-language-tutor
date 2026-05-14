import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface LiquidProgressBarProps {
    progress: number; // 0 to 100
    levelTitle: string;
    targetLevel: string;
    xpPoints: number;
}

export const LiquidProgressBar: React.FC<LiquidProgressBarProps> = ({ progress, levelTitle, targetLevel, xpPoints }) => {
    
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
        <div className="relative w-full max-w-4xl mx-auto p-8 rounded-[40px] bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] overflow-hidden">
            
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-indigo-500/10 blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-6">
                
                {/* Header Information */}
                <div className="flex items-end justify-between">
                    <div>
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-cyan-400">CEFR Mastery</span>
                        <h3 className="text-3xl font-black text-white mt-1 drop-shadow-md">
                            {levelTitle} <span className="text-slate-500">→</span> <span className="text-purple-400">{targetLevel}</span>
                        </h3>
                    </div>
                    
                    <div className="relative">
                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-purple-400">
                            {xpPoints.toLocaleString()} <span className="text-sm text-slate-500">XP</span>
                        </span>
                        
                        {/* Bonus XP Animation */}
                        <AnimatePresence>
                            {showBonus && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20, scale: 0.5 }}
                                    animate={{ opacity: 1, y: -40, scale: 1.2 }}
                                    exit={{ opacity: 0, y: -80, scale: 1 }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className="absolute -top-4 right-0 flex items-center gap-1 text-amber-400 font-black drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                                >
                                    <Sparkles size={16} />
                                    <span>+XP</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* The Liquid Bar Container */}
                <div className="relative h-12 w-full bg-slate-950/80 rounded-full border border-white/5 overflow-hidden shadow-inner flex items-center justify-center">
                    
                    {/* Dark/Empty state text overlay (under liquid) */}
                    <span className="absolute z-20 text-xs font-black text-white/50 tracking-widest mix-blend-difference">
                        {progress.toFixed(1)}% MASTERY
                    </span>

                    {/* Liquid Fill */}
                    <motion.div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-purple-600 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
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
            </div>
        </div>
    );
};
