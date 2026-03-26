import React from 'react';
import { FadeTransition } from '../lib/animations';
import { User, Lock, Sparkles } from 'lucide-react';

interface AuthViewProps {
  onLogin: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  return (
    <FadeTransition className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-indigo-100 blur-[80px] rounded-full translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-blue-100 blur-[80px] rounded-full -translate-x-1/3 translate-y-1/3" />

      <div className="w-full max-w-md bg-white rounded-[2rem] p-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100 relative z-10">
        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Welcome</h1>
          <p className="text-slate-500 text-sm font-medium">Sign in to begin your personalized language journey.</p>
        </div>

        <form className="space-y-5 relative z-10" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                defaultValue="learner@fluent.ai"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="space-y-1.5 mb-8">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                defaultValue="••••••••"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-all shadow-[0_8px_20px_rgba(79,70,229,0.25)] active:scale-[0.98]"
          >
            Sign In & Continue
          </button>
        </form>
      </div>
    </FadeTransition>
  );
};
