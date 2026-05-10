import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
    Zap, Sparkles, Repeat, Type, BookMarked, 
    CheckCircle2, XCircle, ArrowRight, Info
} from 'lucide-react';

interface DailyBites {
    vocabulary?: {
        topic: string;
        steps: { level: string; word: string }[];
        context_note: string;
    };
    grammar?: {
        type: string;
        incorrect: string;
        correct: string;
        rule: string;
    };
    style?: {
        focus: string;
        basic_b1: string;
        advanced_c1_academic: string;
        style_note: string;
    };
    punctuation?: {
        focus: string;
        rule: string;
        example: string;
    };
}

const MOCK_BITES: DailyBites = {
    vocabulary: {
        topic: "Resource Utilization",
        steps: [
            { level: "A1", word: "use" },
            { level: "B2", word: "utilize" },
            { level: "C1", word: "leverage" }
        ],
        context_note: "Instead of saying 'We use the data', say 'We leverage the dataset to optimize the neural work'. 'Leverage' implies utilizing a resource to its maximum strategic advantage."
    },
    grammar: {
        type: "Personalized Remediation",
        incorrect: "He explained me the problem.",
        correct: "He explained the problem to me.",
        rule: "Verb 'explain' needs 'to' for personal objects."
    },
    style: {
        focus: "Academic Tone",
        basic_b1: "I want to talk about the project.",
        advanced_c1_academic: "I would like to discuss the project.",
        style_note: "'Discuss' and 'would like to' elevate the professional tone significantly."
    },
    punctuation: {
        focus: "The Oxford Comma",
        rule: "The Oxford comma is the final comma in a list of three or more items.",
        example: "I want to talk about AI, ML, and the Oxford comma."
    }
};

export const DailyMicroLearning: React.FC = () => {
    const [bites, setBites] = useState<DailyBites>(MOCK_BITES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBites = async () => {
            try {
                const response = await fetch('/api/v1/daily/bites', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.daily_bites) {
                        setBites(data.daily_bites);
                    }
                }
            } catch (err) {
                console.error("Failed to load daily bites, using mock", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBites();
    }, []);

    // We NEVER return null now. Even if fetch fails, we show MOCK_BITES.
    return (
        <div className="space-y-6 mb-12">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                    Daily Micro-Learning Hub
                </h2>
            </div>

            <div className="flex flex-col gap-6">
                {/* 1. Vocabulary Progression */}
                {bites.vocabulary && (
                    <VerticalBiteCard 
                        title="Level Up Your Vocabulary"
                        badge="AI Engineering"
                        icon={<Sparkles size={20} className="text-indigo-400" />}
                        gradient="from-indigo-900/40 to-blue-900/40"
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between max-w-lg mx-auto w-full px-4">
                                {bites.vocabulary.steps.map((step, i) => (
                                    <React.Fragment key={i}>
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{step.level}</span>
                                            <span className={`text-xl font-black ${i === 2 ? 'text-white scale-125' : 'text-slate-500 opacity-60'}`}>
                                                {step.word}
                                            </span>
                                        </div>
                                        {i < 2 && <ArrowRight size={20} className="text-slate-700 mt-4" />}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-sm text-slate-300 italic leading-relaxed">
                                {bites.vocabulary.context_note}
                            </div>
                        </div>
                    </VerticalBiteCard>
                )}

                {/* 2. Grammar Remediation */}
                {bites.grammar && (
                    <VerticalBiteCard 
                        title={bites.grammar.type === 'Personalized Remediation' ? 'Personalized Grammar Check: Your Error Profile' : 'Common Grammar Pitfall'}
                        icon={<Repeat size={20} className="text-rose-400" />}
                        gradient="from-rose-900/40 to-slate-900/40"
                    >
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <XCircle size={12} className="text-rose-500" /> Your Mistake (Recently Detected)
                                    </span>
                                    <p className="text-sm font-bold text-slate-300">
                                        {bites.grammar.incorrect}
                                    </p>
                                </div>
                                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle2 size={12} className="text-emerald-500" /> AI Correction
                                    </span>
                                    <p className="text-sm font-bold text-white">
                                        {bites.grammar.correct}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/50 text-xs text-slate-400 font-medium">
                                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                {bites.grammar.rule}
                            </div>
                        </div>
                    </VerticalBiteCard>
                )}

                {/* 3. Style Transformer */}
                {bites.style && (
                    <VerticalBiteCard 
                        title="Writing Style Transformer: Elevate Your Tone"
                        icon={<Type size={20} className="text-blue-400" />}
                        gradient="from-blue-900/40 to-indigo-900/40"
                    >
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Basic (B1)</span>
                                    <p className="text-sm font-bold text-slate-300 italic">"{bites.style.basic_b1}"</p>
                                </div>
                                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Academic (C1)</span>
                                    <p className="text-sm font-bold text-white">"{bites.style.advanced_c1_academic}"</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-900/50 text-xs text-slate-400 italic">
                                <span className="font-black text-indigo-400 uppercase mr-2">Style Note:</span>
                                {bites.style.style_note}
                            </div>
                        </div>
                    </VerticalBiteCard>
                )}

                {/* 4. Punctuation */}
                {bites.punctuation && (
                    <VerticalBiteCard 
                        title={`Punctuation Mechanic: ${bites.punctuation.focus}`}
                        icon={<BookMarked size={20} className="text-emerald-400" />}
                        gradient="from-emerald-900/40 to-slate-900/40"
                    >
                        <div className="space-y-4">
                            <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                {bites.punctuation.rule}
                            </p>
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Example</span>
                                <p className="text-sm font-bold text-white italic">"{bites.punctuation.example}"</p>
                            </div>
                        </div>
                    </VerticalBiteCard>
                )}
            </div>
        </div>
    );
};

interface VerticalBiteCardProps {
    title: string;
    badge?: string;
    icon: React.ReactNode;
    gradient: string;
    children: React.ReactNode;
}

const VerticalBiteCard: React.FC<VerticalBiteCardProps> = ({ title, badge, icon, gradient, children }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full p-8 rounded-[32px] bg-gradient-to-br ${gradient} border border-white/10 shadow-2xl overflow-hidden group`}
    >
        <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 shadow-lg">
                    {icon}
                </div>
                <h3 className="text-lg font-black text-white tracking-tight leading-tight">{title}</h3>
            </div>
            {badge && (
                <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[8px] font-black text-white uppercase tracking-widest text-center flex flex-col">
                    <span>AI</span>
                    <span>ENGINEERING</span>
                </div>
            )}
        </div>
        
        <div className="relative z-10">
            {children}
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
    </motion.div>
);
