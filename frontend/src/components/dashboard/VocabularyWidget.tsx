import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Quote, Zap, Volume2 } from 'lucide-react';

export interface VocabularyData {
    skill: string;
    task_type: string;
    level: string;
    prompt: string;
    stimulus: string;
    answer_key: {
        explanation: string;
    };
    metadata: {
        synonym_chain: Record<string, string>;
    };
}

const sampleData: VocabularyData = {
    skill: "Vocabulary",
    task_type: "Synonym Progression",
    level: "C1",
    prompt: "Level Up Your Vocabulary",
    stimulus: "Enhance your technical writing in AI Engineering by upgrading common verbs.",
    answer_key: {
        explanation: "Instead of saying 'We use the data', say 'We leverage the dataset to optimize the neural network'. 'Leverage' implies utilizing a resource to its maximum strategic advantage."
    },
    metadata: {
        synonym_chain: { 
            "A1": "use", 
            "B2": "utilize", 
            "C1": "leverage" 
        }
    }
};

export const VocabularyWidget: React.FC<{ data?: VocabularyData }> = ({ data = sampleData }) => {
    const [showExample, setShowExample] = useState(false);
    
    const levels = Object.keys(data.metadata.synonym_chain);
    const words = Object.values(data.metadata.synonym_chain);

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden border border-indigo-500/20 text-white w-full max-w-sm group">
            {/* Background Glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-300">
                        <Sparkles size={16} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-200">
                        {data.prompt}
                    </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-black tracking-widest uppercase border border-white/10">
                    AI Engineering
                </span>
            </div>

            {/* Synonym Progression Chain */}
            <div className="flex items-center justify-between my-8 relative z-10 px-2">
                {words.map((word, index) => (
                    <React.Fragment key={word}>
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.2 }}
                            className="flex flex-col items-center gap-1"
                        >
                            <span className={`text-[10px] font-black tracking-widest ${index === words.length - 1 ? 'text-indigo-300' : 'text-slate-500'}`}>
                                {levels[index]}
                            </span>
                            <span className={`font-black tracking-tight ${index === words.length - 1 ? 'text-2xl text-white drop-shadow-md' : 'text-lg text-slate-400 line-through decoration-slate-600/50'}`}>
                                {word}
                            </span>
                        </motion.div>
                        
                        {index < words.length - 1 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: (index * 0.2) + 0.1 }}
                                className="text-indigo-500/50"
                            >
                                <ArrowRight size={18} />
                            </motion.div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Interactive Section */}
            <div className="mt-8 relative z-10">
                <AnimatePresence mode="wait">
                    {!showExample ? (
                        <motion.button
                            key="btn"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -10 }}
                            onClick={() => setShowExample(true)}
                            className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group-hover:border-indigo-400/30"
                        >
                            <Quote size={16} className="text-indigo-300" /> Use in a sentence
                        </motion.button>
                    ) : (
                        <motion.div
                            key="example"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-4 bg-black/20 rounded-xl border border-indigo-500/30 relative"
                        >
                            <button 
                                onClick={() => setShowExample(false)}
                                className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
                            >
                                &times;
                            </button>
                            <p className="text-sm text-indigo-100 font-medium leading-relaxed pr-4">
                                {data.answer_key.explanation}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
