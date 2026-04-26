import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, Link2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { InviteService, InvitePeek } from '../services/InviteService';
import { useData } from '../context/DataContext';

const INVITE_TOKEN_KEY = 'pending_team_invite_token';

export function stashInviteToken(token: string) {
  localStorage.setItem(INVITE_TOKEN_KEY, token);
}

export function popInviteToken(): string | null {
  const v = localStorage.getItem(INVITE_TOKEN_KEY);
  localStorage.removeItem(INVITE_TOKEN_KEY);
  return v;
}

export function peekInviteToken(): string | null {
  return localStorage.getItem(INVITE_TOKEN_KEY);
}

const InviteAcceptView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshData } = useData() as any;

  const [peek, setPeek] = useState<InvitePeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<{ team_name: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing invite token.');
      setLoading(false);
      return;
    }

    InviteService.peekInvite(token)
      .then((p) => {
        if (!p) setError('This invite link is not recognized.');
        else if (p.is_used) setError('This invite has already been used.');
        else if (p.is_expired) setError('This invite has expired.');
        else setPeek(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await InviteService.consumeInvite(token);
      setAccepted({ team_name: result.team_name });
      await refreshData();
      // Auto-route to admin dashboard after a brief confirmation pause
      setTimeout(() => navigate('/admin', { replace: true }), 1400);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('INVITE_ALREADY_USED')) setError('This invite has already been used.');
      else if (msg.includes('INVITE_EXPIRED')) setError('This invite has expired.');
      else if (msg.includes('INVITE_NOT_FOUND')) setError('This invite link is not recognized.');
      else setError(msg || 'Failed to accept invite.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSignInToAccept = () => {
    if (token) stashInviteToken(token);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-white/[0.05] rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center text-cyan-400 mx-auto mb-4">
            <Link2 size={28} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500 mb-1">
            Team Admin Invite
          </p>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {loading ? 'Verifying invite…' : peek ? `Join ${peek.team_name}` : 'Invite'}
          </h1>
        </div>

        <div className="px-8 pb-8 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-red-500 text-sm font-bold flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : accepted ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 text-emerald-500 text-sm font-bold flex items-center gap-3">
              <ShieldCheck size={18} />
              <span>You're now a Team Admin for <span className="text-emerald-400">{accepted.team_name}</span>. Redirecting…</span>
            </div>
          ) : peek ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Accepting this invite will give you the <span className="text-cyan-500 font-bold">Team Admin</span> role
                and add you to <span className="font-bold">{peek.team_name}</span>.
              </p>

              {user ? (
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  {accepting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  Accept & Join Team
                </button>
              ) : (
                <>
                  <p className="text-xs text-slate-500 italic">
                    Sign in or create an account to claim this invite.
                  </p>
                  <button
                    onClick={handleSignInToAccept}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest text-xs py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={14} />
                    Continue to Sign In
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};

export default InviteAcceptView;
