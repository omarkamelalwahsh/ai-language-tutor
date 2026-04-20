import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PrestigeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PrestigeErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-8 text-center overscroll-none transition-colors duration-300">
          {/* Background Decor */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-600/20 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-md w-full space-y-8">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-rose-500/10 border border-rose-500/30 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.2)]">
                <ShieldAlert className="w-12 h-12 text-rose-500" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tighter uppercase italic">
                Protocol <span className="text-rose-500">Desynchronized.</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                The AI model encountered a structural runtime anomaly. 
                Restability protocol is required to restore neural connectivity.
              </p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] text-rose-400/70 overflow-hidden">
               <p className="uppercase tracking-widest mb-2 opacity-50">System Stack Trace:</p>
               <p className="truncate">{this.state.error?.message || "Unknown Runtime Paradox"}</p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full relative group p-[2px] rounded-xl overflow-hidden transition-all active:scale-95"
            >
              <div className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#f43f5e_0%,#4F46E5_50%,#f43f5e_100%)] opacity-50" />
              <div className="relative w-full h-full bg-white dark:bg-gray-900 rounded-[10px] px-8 py-4 flex items-center justify-center gap-3 border border-slate-200 dark:border-gray-800 group-hover:bg-white dark:bg-gray-900-hover transition-colors">
                <RefreshCw className="w-5 h-5 text-rose-400 group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-white font-black uppercase tracking-widest text-xs">Initialization Core Recovery</span>
              </div>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
