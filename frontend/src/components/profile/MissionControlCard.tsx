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
        className={`relative bg-white dark:bg-[#0B1437]/60 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden transition-all duration-500 shadow-premium dark:shadow-none hover:border-blue-500/30 group flex flex-col ${className}`}
    >
        {/* Glow Effects */}
        <div 
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] pointer-events-none transition-opacity duration-500 opacity-20 group-hover:opacity-40" 
            style={{ backgroundColor: glowColor }} 
        />
        
        {title && (
            <div className="px-8 pt-8 pb-4 relative z-10 shrink-0">
                <h3 className="text-[10px] md:text-xs font-black text-slate-500 dark:text-white/30 uppercase tracking-[0.2em] line-clamp-1">{title}</h3>
            </div>
        )}
        
        <div className="relative z-10 flex-1 w-full h-full min-h-0 flex flex-col items-center justify-center">
            {children}
        </div>
    </motion.div>
);
