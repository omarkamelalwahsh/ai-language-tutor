import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, Lightbulb, AlertCircle } from 'lucide-react';

export interface ErrorExample {
    user_answer: string;
    correct_answer: string;
    insight: string;
}

export interface ErrorItem {
    subject: string;
    A?: number;
    type?: string;
    count?: number;
    severity?: string;
    status?: string;
    examples?: ErrorExample[];
}

interface ErrorAnalysisModalProps {
    isOpen: boolean;
    error: ErrorItem | null;
    onClose: () => void;
}

export const ErrorAnalysisModal: React.FC<ErrorAnalysisModalProps> = ({ isOpen, error, onClose }) => {
    if (!error) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                    onClick={onClose}
                >
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl"
                    >
                        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-rose-500/10 to-transparent">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                                    <AlertTriangle className="text-rose-500" /> {error.subject || error.type} Analysis
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Detailed breakdown of identified linguistic friction points.</p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
                            >
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
                            {error.examples && error.examples.length > 0 ? (
                                error.examples.map((ex, idx) => (
                                    <div key={idx} className="space-y-4 p-6 bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                                                    <X size={12} /> Your Response
                                                </span>
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 line-through decoration-rose-500/30 italic">
                                                    "{ex.user_answer || "N/A"}"
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                                    <CheckCircle2 size={12} /> Correct Usage
                                                </span>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                    "{ex.correct_answer || "N/A"}"
                                                </p>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-200 dark:border-white/5">
                                            <div className="flex gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shrink-0 h-fit">
                                                    <Lightbulb size={16} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 block mb-1">AI Insight</span>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                                        {ex.insight}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center space-y-3">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
                                        <AlertCircle size={32} />
                                    </div>
                                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">No specific examples available for this pattern.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
                            <button 
                                onClick={onClose}
                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                Dismiss Analysis
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
