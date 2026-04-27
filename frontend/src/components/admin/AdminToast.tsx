import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCircle2, X } from 'lucide-react';

type ToastKind = 'info' | 'success' | 'error';
interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
}
interface ToastCtx {
  push: (t: Omit<Toast, 'id'>) => void;
}
const Ctx = createContext<ToastCtx | undefined>(undefined);

export const AdminToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, ...t }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
};

const ToastCard: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const tone =
    toast.kind === 'success' ? 'border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300'
    : toast.kind === 'error' ? 'border-red-300 text-red-700 dark:border-red-500/40 dark:text-red-300'
    : 'border-cyan-300 text-cyan-700 dark:border-cyan-500/40 dark:text-cyan-300';

  const Icon = toast.kind === 'success' ? CheckCircle2 : Bell;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`pointer-events-auto min-w-[280px] max-w-sm
                  bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl
                  border ${tone}
                  rounded-2xl px-4 py-3
                  shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.5)]
                  flex gap-3 items-start`}
    >
      <Icon size={18} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-zinc-900 dark:text-zinc-50 text-sm font-bold tracking-tight">{toast.title}</p>
        {toast.body && <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5 leading-snug">{toast.body}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

export const useAdminToast = (): ToastCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdminToast must be used within <AdminToastProvider>');
  return c;
};
