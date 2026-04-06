import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Target, Activity, 
  ChevronRight, ArrowRight,
  Route, BookOpen, LineChart, ShieldCheck,
  BrainCircuit, Mic, BarChart3, Globe,
  Zap, Layers, MessageSquare
} from 'lucide-react';
import { FadeTransition } from '../lib/animations';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const BrowserWindowMockup = () => (
  <div className="relative w-full max-w-2xl mx-auto group">
    {/* Glow background */}
    <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-2xl rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    
    <div className="relative bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-sm">
      {/* Browser Bar */}
      <div className="bg-slate-800/50 px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
        </div>
        <div className="flex-1 mx-4">
          <div className="h-5 bg-slate-950/50 rounded-lg border border-white/5 flex items-center px-3">
             <span className="text-[10px] text-slate-500 font-mono">app.aitutor.io/dashboard/radar</span>
          </div>
        </div>
      </div>

      {/* Browser Content */}
      <div className="p-8">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          {/* Radar Mockup */}
          <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
             <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.3]" />
             <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.6]" />
             <div className="absolute inset-0 border border-white/5 rounded-full" />
             
             {/* The "Radar" shape */}
             <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                <polygon 
                  points="50,10 85,35 75,80 25,80 15,35" 
                  fill="rgba(99,102,241,0.2)" 
                  stroke="#6366f1" 
                  strokeWidth="2"
                  className="animate-pulse"
                />
                {/* Labels */}
                <circle cx="50" cy="10" r="2" fill="#6366f1" />
                <circle cx="85" cy="35" r="2" fill="#6366f1" />
                <circle cx="75" cy="80" r="2" fill="#6366f1" />
                <circle cx="25" cy="80" r="2" fill="#6366f1" />
                <circle cx="15" cy="35" r="2" fill="#6366f1" />
             </svg>
          </div>

          <div className="flex-1 space-y-4">
             <div className="flex justify-between items-end">
               <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Global Proficiency</p>
                  <h3 className="text-3xl font-black text-white">B2 Upper Int.</h3>
               </div>
               <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold">92nd percentile</div>
             </div>
             
             <div className="space-y-3">
               {[
                 { label: "Speaking", val: 85, color: "bg-indigo-500" },
                 { label: "Vocabulary", val: 62, color: "bg-purple-500" },
                 { label: "Listening", val: 78, color: "bg-blue-500" }
               ].map(s => (
                 <div key={s.label}>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                      <span>{s.label}</span>
                      <span>{s.val}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${s.val}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full ${s.color} rounded-full`} 
                      />
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const LandingView: React.FC<LandingViewProps> = ({ onGetStarted, onSignIn }) => {
  return (
    <FadeTransition className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden selection:bg-indigo-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 flex items-center justify-between shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
               <BrainCircuit className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold text-white tracking-tight">AI Tutor<span className="text-indigo-500">.</span></span>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <button 
              onClick={onSignIn}
              className="text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              Login
            </button>
            <button 
              onClick={onGetStarted}
              className="px-4 md:px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] md:text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"
            >
              Get Started <ChevronRight className="w-3 md:w-4 h-3 md:h-4 text-indigo-200" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-44 pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 backdrop-blur-lg">
               <Zap className="w-4 h-4 text-amber-400" />
               <span className="text-[11px] font-bold text-amber-100 uppercase tracking-[0.2em] px-1">Powered by Gemini 1.5 Pro</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight text-white">
              Master Languages with AI that <br className="hidden lg:block"/>
              <span className="bg-gradient-to-r from-indigo-400 via-white to-purple-400 bg-clip-text text-transparent">
                Evolves with You
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
              Quantitative language assessment meets hyper-personalized curriculum. 
              Our engine identifies your CEFR gaps and builds a unique path to proficiency.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold rounded-2xl shadow-2xl shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 group"
              >
                Start Free Assessment <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={onSignIn}
                className="w-full sm:w-auto px-10 py-5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-lg font-bold rounded-2xl backdrop-blur-xl transition-all flex items-center justify-center gap-3"
              >
                View Demo
              </button>
            </div>
          </motion.div>

          {/* Premium Browser Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          >
            <BrowserWindowMockup />
          </motion.div>
        </div>
      </header>

      {/* Feature Grid: WHY US? */}
      <section className="py-24 px-6 relative bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.3em] mb-4">Precision Engine</h2>
            <h3 className="text-4xl md:text-5xl font-black text-white">Engineered for Results.</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: <Target className="w-8 h-8" />, 
                title: "Personalized Error Tracking", 
                desc: "We don't just score you; we build an error profile from your speech and text to target remediation exactly where you fail.",
                color: "text-rose-400",
                bg: "bg-rose-500/10"
              },
              { 
                icon: <Mic className="w-8 h-8" />, 
                title: "Speech Analysis", 
                desc: "Gemini-powered evaluation of your pronunciation, fluency, and prosody. Get feedback that sounds like it's from a native tutor.",
                color: "text-indigo-400",
                bg: "bg-indigo-500/10"
              },
              { 
                icon: <BarChart3 className="w-8 h-8" />, 
                title: "Detailed CEFR Reporting", 
                desc: "Real-time mapping of your skills across global standards. Know your precise level from A1 to C2 with academic rigor.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10"
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="p-10 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-md border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col gap-6"
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center`}>
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-4">{feature.title}</h4>
                  <p className="text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Structured Path Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[160px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-24">
          <div className="flex-1 space-y-12">
            {[
              { icon: <Zap className="w-5 h-5" />, title: "Adaptive Difficulty", desc: "Questions shift in real-time based on your linguistic signals." },
              { icon: <Globe className="w-5 h-5" />, title: "Global Benchmarking", desc: "Compare your performance against CEFR standards globally." },
              { icon: <Layers className="w-5 h-5" />, title: "Structural Journey", desc: "A linear path that evolves as you master individual descriptors." }
            ].map((point, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-6 group"
              >
                <div className="shrink-0 w-12 h-12 bg-indigo-500/10 border border-white/5 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                  {point.icon}
                </div>
                <div>
                  <h5 className="text-xl font-bold text-white mb-2">{point.title}</h5>
                  <p className="text-slate-500 font-medium">{point.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex-1 flex flex-col gap-8">
            <h2 className="text-5xl font-black text-white leading-tight">Beyond chat practice. <br/><span className="text-indigo-500">Structured growth.</span></h2>
            <p className="text-xl text-slate-400 leading-relaxed font-medium">
              We replace aimless conversation with a deterministic learning loop. 
              Our engine measures your exact mastery of grammar and phonetics, then designs the perfect next lesson.
            </p>
            <div className="pt-4">
               <button onClick={onGetStarted} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10 flex items-center gap-3">
                 How the Engine works <ArrowRight className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <footer className="py-32 px-6">
        <div className="max-w-5xl mx-auto rounded-[3rem] p-12 md:p-24 bg-gradient-to-br from-indigo-600 to-purple-700 text-center relative overflow-hidden shadow-2xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">Stop Guessing. <br className="hidden md:block"/>Start Mastering.</h2>
            <p className="text-indigo-100 text-lg md:text-xl max-w-xl mx-auto mb-12 font-medium">
              Join thousands of learners identifying their true baseline today. Free to start, adaptive forever.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto px-12 py-6 bg-white text-indigo-600 hover:bg-slate-900 hover:text-white text-xl font-bold rounded-2xl transition-all shadow-xl active:scale-95"
              >
                Start Assessment
              </button>
              <button className="flex items-center gap-2 text-white font-bold px-8 py-4 hover:underline">
                <MessageSquare className="w-5 h-5" /> Chat with Sales
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-2 grayscale brightness-200 opacity-50">
             <BrainCircuit className="w-6 h-6" />
             <span className="text-xl font-bold text-white tracking-tight">AI Tutor.</span>
           </div>
           <div className="flex gap-10 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <a href="#" className="hover:text-indigo-400">Terms</a>
              <a href="#" className="hover:text-indigo-400">Privacy</a>
              <a href="#" className="hover:text-indigo-400">Whitepaper</a>
              <a href="#" className="hover:text-indigo-400">Open Source</a>
           </div>
        </div>
      </footer>
    </FadeTransition>
  );
};
