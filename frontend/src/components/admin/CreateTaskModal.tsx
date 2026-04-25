import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTaskService, AdminTask } from '../../services/AdminTaskService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (task: AdminTask) => void;
}

export const CreateTaskModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const adminsQuery = useQuery({
    queryKey: ['superadmin', 'admins'],
    queryFn: () => AdminTaskService.listAdmins(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string; assigned_to: string; deadline: string | null }) =>
      AdminTaskService.createTask(input),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'tasks'] });
      onCreated?.(task);
      reset();
      onClose();
    },
    onError: (err: any) => setError(err?.message ?? 'Failed to create task'),
  });

  const reset = () => {
    setTitle(''); setDescription(''); setAssignedTo(''); setDeadline(''); setError(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !assignedTo) return;
    createMutation.mutate({
      title,
      description,
      assigned_to: assignedTo,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-lg bg-[#0F1015] border border-white/[0.08] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

            <header className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-cyan-400/70 uppercase tracking-widest">Task Management Center</p>
                <h2 className="text-white font-bold text-xl tracking-tight mt-0.5">Create New Task</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={onSubmit} className="px-6 pb-6 flex flex-col gap-4">
              <Field label="Title" required>
                <input
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Create 5 Grammar Lessons on Tenses"
                  className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40 transition-all"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Context, acceptance criteria, links…"
                  className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 h-20 resize-none focus:outline-none focus:border-cyan-400/40 transition-all"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Assign to" required>
                  <select
                    required
                    disabled={adminsQuery.isLoading}
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400/40 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#0F1015]">{adminsQuery.isLoading ? 'Loading…' : 'Select admin…'}</option>
                    {(adminsQuery.data ?? []).map(a => (
                      <option key={a.id} value={a.id} className="bg-[#0F1015]">
                        {a.full_name || a.email || a.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Deadline">
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400/40 transition-all"
                  />
                </Field>
              </div>

              {!adminsQuery.isLoading && (adminsQuery.data ?? []).length === 0 && (
                <p className="text-[11px] text-amber-400/70 -mt-2">
                  No admins yet. Promote a user via <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">UPDATE profiles SET role=1</span>.
                </p>
              )}

              {error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white/60 hover:bg-white/[0.06] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !title.trim() || !assignedTo}
                  className="flex-1 bg-white text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Dispatch Task
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2 block">
      {label}{required && <span className="text-cyan-400 ml-1">*</span>}
    </span>
    {children}
  </label>
);

export default CreateTaskModal;
