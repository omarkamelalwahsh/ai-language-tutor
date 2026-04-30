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

const cleanPromptText = (rawText: string) => {
  if (!rawText) return "";
  try {
    const parsedData = JSON.parse(rawText);
    if (parsedData && parsedData.scenario) return parsedData.scenario;
    return parsedData.task || parsedData.description || rawText;
  } catch (error) {
    return rawText.replace(/^(Scenario|Task|Context):\s*/i, '');
  }
};

const formatStimulusText = (text: string) => {
  if (!text) return "";
  const cleanedText = cleanPromptText(text);
  let html = cleanedText
    // Times (e.g. 10:00 AM, 14:30)
    .replace(/\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\b/g, '<strong class="font-bold underline decoration-blue-200 dark:decoration-blue-900 underline-offset-4">$1</strong>')
    // Days
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g, '<strong class="font-bold underline decoration-blue-200 dark:decoration-blue-900 underline-offset-4">$1</strong>')
    // Dates (e.g. October 12th)
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi, '<strong class="font-bold underline decoration-blue-200 dark:decoration-blue-900 underline-offset-4">$&</strong>')
    // Basic Markdown **bold** fallback
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
    // Newlines to paragraph breaks with spacing
    .split(/\n+/)
    .filter(p => p.trim() !== '')
    .map(p => `<p class="mb-5">${p}</p>`)
    .join('');
    
  return html;
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
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-[#F7F8FC] dark:bg-gray-950">
      {/* 📖 LEFT SIDE: FIXED PASSAGE */}
      <aside className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-y-auto p-8 lg:p-12 bg-white dark:bg-gray-900 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-gray-800 shadow-[inset_-10px_0_30px_-20px_rgba(0,0,0,0.05)] custom-scrollbar">
        <div className="max-w-2xl mx-auto">
          <div className={`flex items-center gap-2 mb-8 px-4 py-2 rounded-xl w-fit ${badge.color}`}>
            {badge.icon}
            <span className="text-[10px] font-black uppercase tracking-widest">{badge.label}</span>
          </div>
          
          <div className="prose prose-slate dark:prose-invert prose-lg max-w-none">
            <div 
              className="text-lg lg:text-xl text-slate-700 dark:text-slate-300 leading-[1.9] font-medium selection:bg-indigo-100 dark:selection:bg-indigo-900"
              dangerouslySetInnerHTML={{ __html: formatStimulusText(stimulus) }}
            />
          </div>
          
          {/* Subtle indicator that there is more content below if scrolling is needed */}
          <div className="mt-12 h-20 bg-gradient-to-t from-slate-50/10 dark:from-gray-900/10 to-transparent pointer-events-none" />
        </div>
      </aside>

      {/* ❓ RIGHT SIDE: DYNAMIC QUESTIONS */}
      <section className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-y-auto bg-[#F7F8FC] dark:bg-gray-950 custom-scrollbar">
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
                    ? 'w-10 bg-blue-600 dark:bg-blue-400'
                    : 'w-6 bg-slate-200 dark:bg-gray-800'
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
