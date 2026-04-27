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
        roleToAssign: 0,
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
          <motion.div
            className="absolute inset-0 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md
                       bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md
                       border border-white/20 dark:border-zinc-800/50
                       rounded-3xl
                       shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.5)]
                       overflow-hidden flex flex-col"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

            <header className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                  <LinkIcon size={20} />
                </div>
                <div>
                  <h2 className="text-zinc-900 dark:text-zinc-50 font-bold text-lg tracking-tight">
                    Generate Member Invite
                  </h2>
                  <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                    Role: Student / Member
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {!inviteUrl ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                      Expiration
                    </label>
                    <select
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="w-full
                                 bg-white dark:bg-zinc-900
                                 border border-zinc-200 dark:border-zinc-800
                                 rounded-xl px-4 py-3 text-sm
                                 text-zinc-900 dark:text-zinc-50
                                 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40
                                 appearance-none transition-all"
                    >
                      <option value={1}>24 Hours</option>
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                      Internal Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Fall 2026 Cohort"
                      className="w-full
                                 bg-white dark:bg-zinc-900
                                 border border-zinc-200 dark:border-zinc-800
                                 rounded-xl px-4 py-3 text-sm
                                 text-zinc-900 dark:text-zinc-50
                                 placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                                 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40
                                 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={generating || !teamId}
                    className="w-full mt-2
                               bg-gradient-to-r from-cyan-500 to-blue-600
                               hover:from-cyan-400 hover:to-blue-500
                               disabled:opacity-50 disabled:cursor-not-allowed
                               text-white font-black uppercase tracking-widest text-xs
                               py-4 rounded-xl transition-all flex items-center justify-center gap-2
                               shadow-sm hover:shadow-[0_0_24px_rgba(6,182,212,0.35)]"
                  >
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                    Create Invite Link
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm text-center font-semibold">
                    Invite link generated successfully!
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1 block">
                      Share this link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="w-full
                                   bg-zinc-50 dark:bg-zinc-900
                                   border border-zinc-200 dark:border-zinc-800
                                   rounded-xl px-4 py-3 text-sm
                                   text-zinc-900 dark:text-zinc-50
                                   focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      />
                      <button
                        onClick={handleCopy}
                        className={`p-3 rounded-xl transition-all border ${
                          copied
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                            : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                        title="Copy to clipboard"
                      >
                        {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full
                               bg-zinc-100 dark:bg-zinc-800/60
                               hover:bg-zinc-200 dark:hover:bg-zinc-800
                               text-zinc-700 dark:text-zinc-200
                               font-black uppercase tracking-widest text-[10px]
                               py-3 rounded-xl transition-all
                               border border-zinc-200 dark:border-zinc-700"
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
