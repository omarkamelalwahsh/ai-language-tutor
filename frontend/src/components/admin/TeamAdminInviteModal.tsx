import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link as LinkIcon, Loader2, Copy, CheckCircle2, ShieldAlert } from 'lucide-react';
import { InviteService, buildInviteUrl } from '../../services/InviteService';

interface Props {
  open: boolean;
  teamId: string | null;
  onClose: () => void;
}

export const TeamAdminInviteModal: React.FC<Props> = ({ open, teamId, onClose }) => {
  const [generating, setGenerating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional settings for the invite
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [note, setNote] = useState('');

  const handleGenerate = async () => {
    if (!teamId) return;
    setGenerating(true);
    setError(null);
    setInviteUrl(null);
    setCopied(false);

    try {
      const invite = await InviteService.createInvite({
        teamId,
        roleToAssign: 0, // Hardcoded to 0 (Member) for Team Admins
        expiresInDays,
        note: note.trim() || undefined,
      });
      setInviteUrl(buildInviteUrl(invite.token));
    } catch (err: any) {
      setError(err.message || 'Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleReset = () => {
    setInviteUrl(null);
    setCopied(false);
    setError(null);
    setNote('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md bg-[#0F1015] border border-white/[0.08] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

            <header className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400">
                  <LinkIcon size={20} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg tracking-tight">Generate Member Invite</h2>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                    Role: Student / Member
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {!inviteUrl ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 mb-2 block">
                      Expiration
                    </label>
                    <select
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/40 appearance-none"
                    >
                      <option value={1} className="bg-slate-900">24 Hours</option>
                      <option value={7} className="bg-slate-900">7 Days</option>
                      <option value={30} className="bg-slate-900">30 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 mb-2 block">
                      Internal Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Fall 2026 Cohort"
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/40"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating || !teamId}
                    className="w-full mt-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                  >
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                    Create Invite Link
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-emerald-400 text-sm text-center">
                    Invite link generated successfully!
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 block">
                      Share this link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                      />
                      <button
                        onClick={handleCopy}
                        className={`p-3 rounded-xl transition-all border ${
                          copied
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                        title="Copy to clipboard"
                      >
                        {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl transition-all"
                  >
                    Generate Another
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
