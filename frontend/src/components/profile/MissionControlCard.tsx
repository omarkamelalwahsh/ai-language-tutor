import React from 'react';
import { motion } from 'motion/react';

interface MissionControlCardProps {
    children: React.ReactNode;
    className?: string;
    glowColor?: string;
    title?: string;
}

export const MissionControlCard: React.FC<MissionControlCardProps> = ({ children, className = "", glowColor = "rgba(59, 130, 246, 0.1)", title }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative bg-white/40 dark:bg-white/[0.02] backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[3rem] overflow-hidden transition-all duration-700 shadow-premium dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] hover:shadow-2xl hover:border-blue-500/40 group flex flex-col ${className}`}
    >
        {/* Dynamic Multi-Glow */}
        <div 
            className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 opacity-20 group-hover:opacity-60 group-hover:scale-110" 
            style={{ backgroundColor: glowColor }} 
        />
        <div 
            className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 opacity-10 group-hover:opacity-30 group-hover:scale-110" 
            style={{ backgroundColor: glowColor }} 
        />
        
        {title && (
            <div className="px-10 pt-10 pb-2 relative z-10 shrink-0">
                <h3 className="text-[11px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.3em] line-clamp-1">{title}</h3>
            </div>
        )}
        
        <div className="relative z-10 flex-1 w-full h-full min-h-0 flex flex-col items-center justify-center">
            {children}
        </div>
    </motion.div>
);
