import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import { UserRole } from '../types/app';
import { supabase } from '../lib/supabaseClient';
import { DB_SCHEMA } from '../constants/dbSchema';
import ThemeToggle from '../components/ThemeToggle';
import { InviteService } from '../services/InviteService';
import { popInviteToken, peekInviteToken } from './InviteAcceptView';
import { NeuralPulseLoader } from '../components/common/NeuralPulseLoader';

export interface AuthViewProps {
  onLogin?: (role: UserRole, onboardingComplete: boolean) => void;
  onBack?: () => void;
  role?: UserRole;
}

/* ── Animated Submit Button ── */
const ChasingLightButton = ({ loading, children, className = '' }: { loading: boolean; children: React.ReactNode; className?: string }) => (
  <button
    type="submit"
    disabled={loading}
    className={`relative group p-[2px] rounded-2xl overflow-hidden transition-all active:scale-[0.98] shadow-premium ${className}`}
  >
    {/* Spinning gradient border */}
    <div className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#3b82f6_0%,#06b6d4_50%,#3b82f6_100%)] opacity-80 group-hover:opacity-100 transition-opacity" />
    <div className="relative w-full h-full bg-blue-600 dark:bg-[#0a0f1a] rounded-[14px] px-8 py-5 flex items-center justify-center gap-3 border border-white/5 group-hover:bg-blue-700 dark:group-hover:bg-[#111827] transition-colors">
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-white dark:text-cyan-400" />
      ) : (
        <span className="text-white font-black uppercase tracking-[0.2em] text-[10px]">{children}</span>
      )}
    </div>
  </button>
);

export function AuthView({ onLogin, onBack, role: initialRole = 'user' }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteMetadata, setInviteMetadata] = useState<{ team_id: string; role_level: number } | null>(null);

  // Added logic for URL param ?token={token}
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      console.log('[Auth] Captured token from URL:', urlToken); // Requirement 4: Debugging
      localStorage.setItem('pending_team_invite_token', urlToken);
      setIsLogin(false); // Force to register page as per prompt
      // Clean up URL
      window.history.replaceState({}, document.title, '/register');

      // Requirement 1: Call backend to verify token before signup
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const API_URL = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
      fetch(`${API_URL}/invites/verify/${urlToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.team_id) {
            console.log('[Auth] Invite verified. Metadata:', data);
            setInviteMetadata(data);
          }
        })
        .catch(err => console.error('[Auth] Token verification failed:', err));

      // NEW: If user is ALREADY logged in, consume it immediately!
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          console.log('[Auth] User already logged in, auto-consuming token...');
          setLoading(true);
          consumePendingInvite(session.user.id, session.user.email || '')
            .then(res => {
               if (res?.navigatedTo) window.location.assign(res.navigatedTo);
               else setLoading(false);
            });
        }
      });
    }
  }, []);

  const pendingInviteToken = peekInviteToken();

  const consumePendingInvite = async (user_id: string, user_email: string): Promise<{ navigatedTo: string } | null> => {
    const token = peekInviteToken(); // Use peek first
    if (!token) {
      console.log('[Auth] No pending invite token found in storage.');
      return null;
    }
    
    console.log('[Auth] Attempting to consume invite token:', token, 'for user:', user_id);
    
    try {
      // Requirement 1 & 2: Use backend to verify and consume
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const API_URL = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
      
      const response = await fetch(`${API_URL}/invites/assign-to-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          current_user_id: user_id,
          email: user_email
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        console.error('[Auth] Backend invite consume error:', err.detail);
        throw new Error(err.detail || 'Failed to consume invite');
      }

      const result = await response.json();
      console.log('[Auth] Invite consumed successfully via backend:', result);
      
      setSuccessMsg('You have successfully joined the team!');
      popInviteToken(); // ONLY NOW remove it from storage
      
      // Give the user a moment to see the success message
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { navigatedTo: '/dashboard' };
    } catch (err: any) {
      console.error('[Auth] invite consume failed catch block:', err?.message);
      setError(`Critical Error: Could not synchronize team invitation. ${err?.message}`);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (role === 'admin') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (loginError) throw loginError;
        
        localStorage.setItem('auth_token', data.session.access_token);
        localStorage.setItem('auth_user_id', data.user.id);
        
        onLogin('admin', true);
      } else {
        if (isLogin) {
          const { data, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (loginError) throw loginError;

          localStorage.setItem('auth_token', data.session.access_token);
          localStorage.setItem('auth_user_id', data.user.id);

          // 🔍 RBAC CHECK: Check the new profiles table for the actual role
          const { data: rbacProfile, error: rbacError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();

          if (rbacError) console.error('[Auth] RBAC fetch error:', rbacError);

          // Consume pending invite first so the role check sees the upgraded role.
          console.log('[Auth] Checking for pending invite after login...');
          const inviteResult = await consumePendingInvite(data.user.id, email);

          const { data: refreshedProfile } = inviteResult
            ? await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
            : { data: rbacProfile };
          const currentRole = refreshedProfile?.role ?? rbacProfile?.role ?? 0;
          console.log('[Auth] Login successful. ID:', data.user.id, 'Role:', currentRole);

          // If Admin or SuperAdmin, bypass student onboarding and go to portal
          if (currentRole === 1 || currentRole === 2) {
            console.log('[Auth] Redirecting to Admin/Portal (Role:', currentRole, ')');
            onLogin?.('admin', true);
          } else {
            console.log('[Auth] Standard user detected. Checking onboarding...');
            const { data: profile } = await supabase
              .from(DB_SCHEMA.TABLES.PROFILES)
              .select(DB_SCHEMA.COLUMNS.ONBOARDING)
              .eq('id', data.user.id)
              .maybeSingle();

            onLogin?.('user', (profile as any)?.[DB_SCHEMA.COLUMNS.ONBOARDING] || false);
          }
        } else {
          let { data, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name,
                role: 'user'
              }
            }
          });
          if (signupError) {
            console.log('[Auth] Signup error encountered:', signupError.message);
            // Seamless Join UX: If user is already registered, try to log them in instead!
            if (signupError.message.toLowerCase().includes('already registered')) {
              console.log('[Auth] User already registered. Attempting seamless login...');
              const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (loginError) {
                console.error('[Auth] Seamless login failed:', loginError.message);
                // If login fails (e.g. wrong password), prompt them clearly
                throw new Error("This email is already registered, but the password was incorrect. Please switch to 'Sign In' to join the team.");
              }
              
              console.log('[Auth] Seamless login successful.');
              // If login succeeds, treat it as a successful signup/login hybrid
              data = loginData;
            } else {
              throw signupError;
            }
          }
          if (!data.session) {
             throw new Error("Please check your email to verify your account.");
          }

          localStorage.setItem('auth_token', data.session.access_token);
          localStorage.setItem('auth_user_id', data.user.id);

          const userId = data.user.id;
          console.log('[Auth] Upserting learner profile for user:', userId);
          const { error: profileError } = await supabase
            .from('learner_profiles')
            .upsert({
              id: userId,
              full_name: name,
              overall_level: 'A1',
              onboarding_complete: false,
              updated_at: new Date().toISOString()
            });

          if (profileError) {
             console.error("[Auth] Initial profile upsert failed:", profileError);
          }

          // If a Team Admin invite is pending, consume it now — promotes the
          // newly signed-up user to role 1 + attaches them to the team.
          console.log('[Auth] Checking for pending invite to consume...');
          const inviteResult = await consumePendingInvite(userId, email);
          if (inviteResult) {
            console.log('[Auth] Invite consumed. Redirecting to admin...');
            onLogin?.('admin', true);
          } else {
            console.log('[Auth] No invite consumed. Proceeding as standard user.');
            onLogin?.('user', false);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && peekInviteToken()) {
    return <NeuralPulseLoader status="Synchronizing Invitation Protocol..." />;
  }

  return (
    <FadeTransition className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
      {/* ── Background Mesh Glows ── */}
      <div className="absolute top-[-20%] right-[-15%] w-[600px] h-[600px] bg-blue-100 dark:bg-blue-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-15%] w-[500px] h-[500px] bg-cyan-100 dark:bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] bg-purple-100/50 dark:bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* ── Back Button ── */}
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 flex items-center text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-white transition-all z-20 font-black text-[10px] uppercase tracking-widest gap-2 bg-white dark:bg-white/5 px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-transparent"
        >
          <ArrowLeft className="w-4 h-4" />
          Return
        </button>
      )}

      <div className="absolute top-8 right-8 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900/50 border border-slate-200 dark:border-gray-800 text-slate-800 dark:text-slate-200 rounded-[3rem] shadow-premium dark:shadow-md overflow-hidden"
        >
          {/* ── Header ── */}
          <div className="p-10 pb-6 text-center">
            <div className="w-20 h-20 bg-blue-600 dark:bg-gradient-to-br dark:from-indigo-600 dark:to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-premium dark:shadow-lg dark:shadow-indigo-500/20">
               {role === 'admin' ? <Shield className="w-10 h-10 text-white" /> : <UserIcon className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50 mb-2 uppercase">
              {role === 'admin' ? 'ROOT_ACCESS' : (isLogin ? 'Welcome' : 'Initialize')}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">
              {role === 'admin' 
                ? 'Administrator Security Portal' 
                : (isLogin ? 'Secure session synchronization' : 'Forging linguistic neural path')
              }
            </p>
          </div>

          {/* ── Role-based Tab Switcher ── */}
          {role === 'user' && (
            <div className="flex mx-10 p-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl mb-8">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-slate-50 shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-slate-50 shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          <div className="px-10 pb-10">
            {pendingInviteToken && (
              <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-500 dark:text-cyan-400 text-xs font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>
                  {inviteMetadata 
                    ? `You've been invited to join a team as a ${inviteMetadata.role_level === 1 ? 'Team Admin' : 'Member'}.`
                    : "You've been invited via a team link. Sign in or create your account to accept."
                  }
                </span>
              </div>
            )}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold flex items-center overflow-hidden"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 flex-shrink-0 animate-pulse"></span>
                  {error}
                </motion.div>
              )}
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-bold flex items-center overflow-hidden"
                >
                  <Shield className="w-4 h-4 mr-2 flex-shrink-0" />
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {!isLogin && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Identity Label</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="text" required value={name} onChange={e => setName(e.target.value)}
                      className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-5 pl-16 pr-6 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-black text-xs uppercase tracking-widest shadow-sm"
                      placeholder="Enter Full Name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Communication Channel</label>
                <div className="relative group">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-5 pl-16 pr-6 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-black text-xs uppercase tracking-widest shadow-sm"
                    placeholder="learner@email.com"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Secret Key</label>
                  {isLogin && <button type="button" className="text-[9px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Recover?</button>}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-5 pl-16 pr-6 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-black text-xs uppercase tracking-widest shadow-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Seal Confirmation</label>
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-5 pl-16 pr-6 text-slate-900 dark:text-slate-50 placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-black text-xs uppercase tracking-widest shadow-sm"
                      placeholder="Repeat Secret Key"
                    />
                  </div>
                </div>
              )}

              <ChasingLightButton loading={loading} className="w-full mt-4">
                {isLogin ? 'Sign In To Master' : 'Initialize Account'}
              </ChasingLightButton>
              
              <div className="pt-6 flex flex-col items-center gap-4">
                 {role === 'user' && (
                    <button 
                      type="button"
                      onClick={() => { setIsLogin(!isLogin); setError(''); }}
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 dark:text-slate-50 transition-colors"
                    >
                      {isLogin ? "No account? Create one" : "Already have an account? Sign in"}
                    </button>
                 )}
                 <button 
                   type="button" 
                   onClick={() => window.location.assign('/admin')}
                   className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-700 hover:text-cyan-400 transition-colors"
                 >
                    <Shield size={12}/>
                    Administrator Override
                 </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </FadeTransition>
  );
}

export default AuthView;
