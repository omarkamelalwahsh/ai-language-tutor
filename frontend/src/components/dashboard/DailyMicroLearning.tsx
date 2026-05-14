import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
    Zap, Sparkles, Repeat, Type, BookMarked, 
    CheckCircle2, XCircle, ArrowRight, Info, Volume2
} from 'lucide-react';
import { learnerService } from '../../services/learnerService';

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

interface DailyMicroLearningProps {
    bites?: DailyBites | null;
    initialCompleted?: string[];
    onInteraction?: () => void;
}

export const DailyMicroLearning: React.FC<DailyMicroLearningProps> = ({ bites: propBites, initialCompleted, onInteraction }) => {
    const [bites, setBites] = useState<DailyBites | null>(null);
    const [loading, setLoading] = useState(true);
    const [completedBites, setCompletedBites] = useState<string[]>([]);
    const [totalXP, setTotalXP] = useState(0);

    const handleSpeak = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const handleComplete = async (type: string) => {
        if (completedBites.includes(type)) return;
        
        try {
            setCompletedBites(prev => [...prev, type]);
            setTotalXP(prev => prev + 5);
            
            // Mark in backend
            await learnerService.completeDailyBite(type);
            
            if (onInteraction) onInteraction();
        } catch (err) {
            console.error("Failed to complete bite", err);
        }
    };

    useEffect(() => {
        if (propBites) {
            setBites(propBites);
            if (initialCompleted) setCompletedBites(initialCompleted);
            setLoading(false);
            return;
        }

        const fetchBites = async () => {
            try {
                const data = await learnerService.getDailyBites();
                if (data.bites) {
                    setBites(data.bites);
                    setCompletedBites(data.completed || []);
                } else {
                    setBites(null);
                }
            } catch (err) {
                console.error("Failed to load daily bites", err);
                setBites(null);
            } finally {
                setLoading(false);
            }
        };

        fetchBites();
    }, [propBites, initialCompleted]);

    if (loading) {
        return (
            <div className="space-y-6 mb-12 animate-pulse">
                <div className="h-8 w-64 bg-slate-200 dark:bg-white/10 rounded-lg mb-8" />
                <div className="h-64 w-full bg-slate-200 dark:bg-white/5 rounded-[32px]" />
            </div>
        );
    }

    if (!bites) {
        return (
            <div className="p-12 rounded-[40px] bg-slate-900/50 border border-white/5 flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 rounded-full bg-indigo-500/10 animate-pulse">
                    <Sparkles className="text-indigo-400" size={32} />
                </div>
                <h3 className="text-xl font-black text-white">Neural Engine Generating...</h3>
                <p className="text-slate-400 text-sm max-w-xs">We are architecting your synchronized daily learning bites.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 mb-12">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        Daily Micro-Learning Hub
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Complete cards to earn +20 XP Daily</p>
                </div>
                {completedBites.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                    >
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span className="text-sm font-black text-emerald-400">+{totalXP} XP EARNED</span>
                    </motion.div>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {/* 1. Vocabulary Progression */}
                {bites.vocabulary && (
                    <VerticalBiteCard 
                        title="Level Up Your Vocabulary"
                        badge="AI Engineering"
                        icon={<Sparkles size={20} className="text-indigo-400" />}
                        gradient="from-indigo-900/40 to-blue-900/40"
                        isCompleted={completedBites.includes('vocabulary')}
                        onComplete={() => handleComplete('vocabulary')}
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between max-w-lg mx-auto w-full px-4">
                                {bites.vocabulary.steps.map((step, i) => (
                                    <React.Fragment key={i}>
                                        <div className="flex flex-col items-center gap-2 group/word">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{step.level}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xl font-black ${i === 2 ? 'text-white scale-125' : 'text-slate-500 opacity-60'}`}>
                                                    {step.word}
                                                </span>
                                                <button 
                                                    onClick={() => handleSpeak(step.word)}
                                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white transition-all opacity-0 group-hover/word:opacity-100"
                                                    title="Listen"
                                                >
                                                    <Volume2 size={12} />
                                                </button>
                                            </div>
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
                        title={bites.grammar.type === 'Personalized Remediation' ? 'Personalized Grammar Check' : 'Common Grammar Pitfall'}
                        icon={<Repeat size={20} className="text-rose-400" />}
                        gradient="from-rose-900/40 to-slate-900/40"
                        isCompleted={completedBites.includes('grammar')}
                        onComplete={() => handleComplete('grammar')}
                    >
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <XCircle size={12} className="text-rose-500" /> Your Mistake
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
                        title="Writing Style Transformer"
                        icon={<Type size={20} className="text-blue-400" />}
                        gradient="from-blue-900/40 to-indigo-900/40"
                        isCompleted={completedBites.includes('style')}
                        onComplete={() => handleComplete('style')}
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
                        isCompleted={completedBites.includes('punctuation')}
                        onComplete={() => handleComplete('punctuation')}
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
    isCompleted?: boolean;
    onComplete?: () => void;
}

const VerticalBiteCard: React.FC<VerticalBiteCardProps> = ({ 
    title, badge, icon, gradient, children, isCompleted, onComplete 
}) => (
    <div className="relative w-full group mb-6">
        <motion.div 
            className={`relative w-full p-8 rounded-[32px] bg-gradient-to-br ${gradient} border ${isCompleted ? 'border-emerald-500/30' : 'border-white/10'} shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] overflow-hidden transition-colors duration-500`}
        >
            <div className="flex items-start justify-between mb-8 relative z-20">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white'} border border-white/10 shadow-lg transition-all duration-500`}>
                        {isCompleted ? <CheckCircle2 size={20} /> : icon}
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight leading-tight">{title}</h3>
                        {isCompleted && (
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1 animate-pulse">Mastered • +5 XP</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {badge && !isCompleted && (
                        <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[8px] font-black text-white uppercase tracking-widest text-center flex flex-col">
                            <span>{badge.split(' ')[0]}</span>
                            <span>{badge.split(' ')[1]}</span>
                        </div>
                    )}
                    {isCompleted ? (
                        <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            Completed
                        </div>
                    ) : (
                        <button 
                            onClick={onComplete}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-[10px] font-black text-white uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        >
                            I Understand
                        </button>
                    )}
                </div>
            </div>
            
            <div className={`relative z-10 px-4 transition-all duration-500 ${isCompleted ? 'opacity-90' : 'opacity-100'}`}>
                {children}
            </div>

            {/* Decorative background elements */}
            <div className={`absolute top-0 right-0 w-64 h-64 ${isCompleted ? 'bg-emerald-500/10' : 'bg-white/5'} rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-colors duration-500`} />
            
            {/* Completion subtle overlay */}
            {isCompleted && (
                <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none" />
            )}
        </motion.div>
    </div>
);
