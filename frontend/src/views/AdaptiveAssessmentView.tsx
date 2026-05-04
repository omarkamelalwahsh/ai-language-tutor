import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assessmentService } from '../services/assessmentService';
import AdaptiveTaskCard from '../components/assessment/AdaptiveTaskCard';
import { Loader2, Sparkles, Brain } from 'lucide-react';

import { useSupabaseDashboard } from '../hooks/useSupabaseDashboard';

const AdaptiveAssessmentView = () => {
  const { refresh } = useSupabaseDashboard();

  return (
    <div className="min-h-screen w-full bg-[#020617] relative overflow-hidden flex items-center justify-center p-6 selection:bg-blue-500/30">
      {/* Mesh Gradient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[150px]" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-600/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <div className="mb-8 flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                <Brain className="text-blue-400" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-1">Adaptive Assessment</h1>
                <p className="text-xs font-black text-blue-500 uppercase tracking-[0.2em]">Closed-Loop Engine v1.0</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
               <Sparkles size={14} className="text-amber-400" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Optimized</span>
            </div>
          </div>

          {/* 
              AdaptiveTaskCard is self-contained. 
              It will fetch its own task data if no initialTaskData is provided.
          */}
          <AdaptiveTaskCard 
            userId={localStorage.getItem('auth_user_id') || 'learner_prime'}
            onComplete={() => {
               if (refresh) refresh();
               window.history.back();
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default AdaptiveAssessmentView;
