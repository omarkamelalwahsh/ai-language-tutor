import React from 'react';
import { motion } from 'motion/react';
import { Bot, User } from 'lucide-react';

interface TutorBubbleProps {
    text: string;
    sender: 'user' | 'tutor';
    isLatest: boolean;
}

export const TutorBubble: React.FC<TutorBubbleProps> = ({ text, sender, isLatest }) => {
    const isTutor = sender === 'tutor';

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className={`flex w-full gap-3 mb-4 ${isTutor ? 'justify-start' : 'justify-end'}`}
        >
            {isTutor && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    <Bot size={16} className="text-indigo-400" />
                </div>
            )}
            
            <div className={`
                max-w-[80%] p-4 rounded-[20px] backdrop-blur-md border shadow-lg leading-relaxed text-sm
                ${isTutor 
                    ? 'bg-slate-900/60 border-indigo-500/20 text-slate-100 rounded-tl-sm' 
                    : 'bg-indigo-600/60 border-indigo-500/40 text-white rounded-tr-sm'}
            `}>
                {text}
            </div>

            {!isTutor && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <User size={16} className="text-emerald-400" />
                </div>
            )}
        </motion.div>
    );
};
