import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Pen } from 'lucide-react';

interface ReadingLayoutProps {
  stimulus: string;
  children: React.ReactNode;
  currentQuestionIndex: number;
  totalInBundle: number;
  /** Active skill determines the badge text and icon */
  activeSkill?: 'reading' | 'grammar' | 'writing';
}

const BADGE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  reading: { label: 'Reading Passage', icon: <BookOpen size={16} className="font-bold" />, color: 'bg-blue-50 dark:bg-blue-900/30 text-indigo-700' },
  grammar: { label: 'Reading Passage', icon: <BookOpen size={16} className="font-bold" />, color: 'bg-blue-50 dark:bg-blue-900/30 text-indigo-700' },
  writing:  { label: 'Writing Task — Reference Text', icon: <Pen size={16} className="font-bold" />, color: 'bg-emerald-50 text-emerald-700' },
};

export const ReadingLayout: React.FC<ReadingLayoutProps> = ({ 
  stimulus, 
  children, 
  currentQuestionIndex,
  totalInBundle,
  activeSkill = 'reading'
}) => {
  const badge = BADGE_CONFIG[activeSkill] || BADGE_CONFIG.reading;

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-[#F7F8FC]">
      {/* 📖 LEFT SIDE: FIXED PASSAGE */}
      <aside className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-y-auto p-8 lg:p-12 bg-white border-b lg:border-b-0 lg:border-r border-slate-100 shadow-[inset_-10px_0_30px_-20px_rgba(0,0,0,0.05)] custom-scrollbar">
        <div className="max-w-2xl mx-auto">
          <div className={`flex items-center gap-2 mb-8 px-4 py-2 rounded-xl w-fit ${badge.color}`}>
            {badge.icon}
            <span className="text-[10px] font-black uppercase tracking-widest">{badge.label}</span>
          </div>
          
          <div className="prose prose-slate prose-lg max-w-none">
            <div className="text-xl lg:text-2xl text-slate-700 leading-[1.8] font-medium selection:bg-indigo-100 whitespace-pre-wrap">
              {stimulus}
            </div>
          </div>
          
          {/* Subtle indicator that there is more content below if scrolling is needed */}
          <div className="mt-12 h-20 bg-gradient-to-t from-slate-50/10 to-transparent pointer-events-none" />
        </div>
      </aside>

      {/* ❓ RIGHT SIDE: DYNAMIC QUESTIONS */}
      <section className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-y-auto bg-[#F7F8FC] custom-scrollbar">
        <div className="max-w-xl mx-auto px-6 py-12 lg:py-20 flex flex-col min-h-full">
          {/* Bundle Progress Indicator */}
          <div className="flex items-center gap-1.5 mb-8">
            {Array.from({ length: totalInBundle }).map((_, i) => (
              <div 
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < (currentQuestionIndex % totalInBundle) 
                    ? 'w-6 bg-emerald-500' 
                    : i === (currentQuestionIndex % totalInBundle)
                    ? 'w-10 bg-blue-600 dark:bg-blue-600'
                    : 'w-6 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex-1"
          >
            {children}
          </motion.div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}} />
    </div>
  );
};
