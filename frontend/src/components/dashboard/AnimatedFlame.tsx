import React from 'react';
import { motion } from 'motion/react';
import { Flame } from 'lucide-react';

export type FlameState = 'active' | 'warning' | 'broken';

interface AnimatedFlameProps {
    streak: number;
    state: FlameState;
}

export const AnimatedFlame: React.FC<AnimatedFlameProps> = ({ streak, state }) => {
    
    // Config based on state
    const config = {
        active: {
            color: 'text-orange-500',
            glow: 'rgba(249, 115, 22, 0.6)',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/20',
            animation: {
                scale: [1, 1.1, 1],
                rotate: [-2, 2, -2],
                transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            }
        },
        warning: {
            color: 'text-rose-500',
            glow: 'rgba(244, 63, 94, 0.4)',
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/20',
            animation: {
                scale: [1, 0.9, 1.05, 0.95, 1],
                opacity: [1, 0.5, 1, 0.7, 1],
                transition: { duration: 0.5, repeat: Infinity }
            }
        },
        broken: {
            color: 'text-slate-400',
            glow: 'rgba(148, 163, 184, 0)',
            bg: 'bg-slate-800/30 backdrop-blur-md',
            border: 'border-slate-700/50',
            animation: {
                scale: 1,
                rotate: 0,
                transition: { duration: 0 }
            }
        }
    };

    const currentConfig = config[state];

    return (
        <div className="flex items-center gap-3">
            <motion.div 
                className={`relative w-12 h-12 flex items-center justify-center rounded-2xl border ${currentConfig.border} ${currentConfig.bg} backdrop-blur-xl shadow-2xl`}
                animate={{
                    boxShadow: [
                        `0 0 10px ${currentConfig.glow}`,
                        `0 0 25px ${currentConfig.glow}`,
                        `0 0 10px ${currentConfig.glow}`
                    ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
            >
                {/* Flame Icon with custom animations */}
                <motion.div
                    animate={currentConfig.animation}
                    className="relative z-10"
                >
                    <Flame size={24} className={`${currentConfig.color}`} />
                </motion.div>
                
                {/* Frost effect for broken state */}
                {state === 'broken' && (
                    <div className="absolute inset-0 bg-white/5 rounded-2xl backdrop-blur-[2px] pointer-events-none border border-white/10" />
                )}
            </motion.div>
            
            <div className="flex flex-col">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Streak</span>
                <span className={`text-2xl font-black ${state === 'broken' ? 'text-slate-500' : 'text-white'} drop-shadow-lg`}>
                    {streak}
                </span>
            </div>
        </div>
    );
};
