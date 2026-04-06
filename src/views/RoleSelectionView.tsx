import React from 'react';
import { motion } from 'motion/react';
import { FadeTransition } from '../lib/animations';
import { User, ShieldUser } from 'lucide-react';
import { UserRole } from '../types/app';

interface RoleSelectionViewProps {
  onSelectRole: (role: UserRole) => void;
}

export function RoleSelectionView({ onSelectRole }: RoleSelectionViewProps) {
  return (
    <FadeTransition className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      <div className="max-w-4xl w-full relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center p-3 sm:p-4 bg-indigo-500/10 rounded-2xl sm:rounded-3xl mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)] border border-indigo-500/20 backdrop-blur-xl group hover:bg-indigo-500/20 transition-colors cursor-default">
            <span className="text-3xl sm:text-5xl">⚡</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            AI Language <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Tutor</span>
          </h1>
          <p className="text-xl text-slate-300 font-light max-w-2xl mx-auto">
            Choose how you want to continue.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectRole('user')}
            className="group relative overflow-hidden bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-10 rounded-3xl text-left hover:border-indigo-500/50 hover:shadow-[0_0_40px_rgba(99,102,241,0.15)] transition-all duration-300 flex flex-col items-center md:items-start text-center md:text-left"
          >
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors">
              <User className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Trainee</h3>
            <p className="text-slate-400 font-light text-base md:text-lg mb-8 leading-relaxed">
              Start your personalized language assessment and dive into the adaptive learning dashboard.
            </p>
            <div className="mt-auto w-full flex items-center justify-center md:justify-start text-indigo-400 font-medium group-hover:translate-x-2 transition-transform">
              Continue as Trainee <span className="ml-2">→</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 via-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectRole('admin')}
            className="group relative overflow-hidden bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-10 rounded-3xl text-left hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all duration-300 flex flex-col items-center md:items-start text-center md:text-left"
          >
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
              <ShieldUser className="w-10 h-10 text-cyan-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Administrator</h3>
            <p className="text-slate-400 font-light text-base md:text-lg mb-8 leading-relaxed">
              Access the analytics engine, review learner cohorts, and manage global system settings.
            </p>
            <div className="mt-auto w-full flex items-center justify-center md:justify-start text-cyan-400 font-medium group-hover:translate-x-2 transition-transform">
              Continue as Admin <span className="ml-2">→</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </motion.button>
        </div>
      </div>
    </FadeTransition>
  );
}
