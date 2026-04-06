import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import { UserRole } from '../types/app';

export interface AuthViewProps {
  onLogin: (role: UserRole, onboardingComplete: boolean) => void;
  onBack: () => void;
  role: UserRole;
}

export function AuthView({ onLogin, onBack, role: initialRole }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const endpoint = role === 'admin' 
        ? '/api/auth/admin/login' 
        : (isLogin ? '/api/auth/trainee/login' : '/api/auth/trainee/signup');

      const body = isLogin 
        ? { email, password } 
        : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save token locally
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user_id', data.user.id);
      
      onLogin(role, data.user.onboarding_complete);

    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeTransition className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-3xl -z-1 translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-50/50 rounded-full blur-3xl -z-1 -translate-x-1/3 translate-y-1/3" />

      <button 
        onClick={onBack}
        className="absolute top-8 left-8 flex items-center text-slate-500 hover:text-slate-900 transition-colors z-20 font-bold"
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        Back
      </button>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden"
        >
          {/* Header */}
          <div className="p-10 pb-6 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-100">
               {role === 'admin' ? <Shield className="w-8 h-8 text-white" /> : <UserIcon className="w-8 h-8 text-white" />}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              {role === 'admin' ? 'Admin Access' : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-slate-500 font-medium text-sm">
              {role === 'admin' 
                ? 'Sign in to management console' 
                : (isLogin ? 'Enter your details to continue' : 'Get started with your English journey')
              }
            </p>
          </div>

          {/* Admin Toggle */}
          {isLogin && (
            <div className="px-10 mb-4 flex justify-end">
               <button 
                type="button"
                onClick={() => setRole(role === 'admin' ? 'user' : 'admin')}
                className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
               >
                 {role === 'admin' ? <UserIcon className="w-3.5 h-3.5"/> : <Shield className="w-3.5 h-3.5"/>}
                 {role === 'admin' ? 'Student Login' : 'Admin Login'}
               </button>
            </div>
          )}

          {/* Role-based Tab Switcher: Admins cannot signup */}
          {role === 'user' && (
            <div className="flex mx-10 p-1 bg-slate-50 border border-slate-100 rounded-2xl mb-8">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          <div className="px-10 pb-10">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center overflow-hidden shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2 flex-shrink-0 animate-pulse"></span>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-500 transition-all font-bold"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-500 transition-all font-bold"
                    placeholder="name@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-500 transition-all font-bold"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-500 transition-all font-bold"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-2xl py-5 font-black uppercase tracking-widest flex items-center justify-center transition-all ${
                  loading 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-slate-900 text-white shadow-xl shadow-indigo-100 hover:shadow-indigo-200'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>{isLogin ? 'Enter Portal' : 'Register Now'}</span>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </FadeTransition>
  );
}
