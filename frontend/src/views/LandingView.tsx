import React from 'react';
import { motion } from 'motion/react';
import { 
  Target, ChevronRight, ArrowRight,
  BrainCircuit, Mic, BarChart3, Globe,
  Zap, Layers
} from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import ThemeToggle from '../components/ThemeToggle';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onGetStarted, onSignIn }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 overflow-x-hidden selection:bg-indigo-500/30 font-sans relative transition-colors duration-300">
      
      {/* ── BACKGROUND MESH GRADIENTS ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
         <motion.div 
           animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3], rotate: [0, 90, 0] }}
           transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
           className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-purple-600/20 rounded-full blur-[140px]" 
         />
         <motion.div 
           animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2], rotate: [0, -90, 0] }}
           transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
           className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-emerald-500/20 rounded-full blur-[160px]" 
         />
         <motion.div 
           animate={{ opacity: [0.15, 0.25, 0.15] }}
           transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
           className="absolute top-[20%] left-[20%] w-[50vw] h-[50vw] bg-blue-600 dark:bg-blue-600/30 rounded-full blur-[160px]" 
         />
         {/* Subtle Noise Overlay */}
         <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMjAwIDIwMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZmlsdGVyIGlkPSdub2lzZUZpbHRlcic+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuNjUnIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWx0ZXI9J3VybCgjbm9pc2VGaWx0ZXIpJy8+PC9zdmc+')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <FadeTransition className="relative z-10 flex flex-col min-h-screen">
        {/* ── GLASS NAVBAR ── */}
        <nav className="w-full pt-8 px-4 flex justify-center z-50">
          <div className="w-full max-w-5xl bg-white dark:bg-gray-900/70 backdrop-blur-2xl border border-slate-200 dark:border-gray-800 rounded-3xl px-8 py-4 flex items-center justify-between shadow-sm dark:shadow-md dark:shadow-sm dark:shadow-md transition-colors duration-300">
            
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 dark:text-slate-900 dark:text-slate-50 font-bold text-lg tracking-tight">
               AI Tutor
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
               <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Products</a>
               <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Pricing</a>
               <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Models & Free</a>
            </div>

            <div className="flex items-center gap-6">
              <ThemeToggle />
              <button onClick={onSignIn} className="text-sm font-medium text-slate-800 dark:text-slate-200 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-50 transition-colors">
                Log in
              </button>
              <button onClick={onGetStarted} className="px-5 py-2.5 bg-blue-600 dark:bg-blue-600 dark:bg-white/10 hover:bg-indigo-700 dark:hover:bg-white/20 text-slate-900 dark:text-slate-50 text-sm font-bold rounded-xl border border-transparent dark:border-white/10 transition-all backdrop-blur-md">
                Sign up
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO SECTION ── */}
        <header className="flex flex-col items-center pt-32 pb-40 px-6 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-6xl md:text-8xl font-bold tracking-tight text-slate-900 dark:text-slate-900 dark:text-slate-50 max-w-5xl leading-[1.05]"
          >
            Master Languages <br/>
            with AI that Evolves <br/>
            <span className="text-indigo-500 dark:text-slate-400">with You</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="mt-8 text-xl md:text-2xl text-slate-800 dark:text-slate-200 dark:text-slate-500 dark:text-slate-400 max-w-2xl font-light leading-relaxed"
          >
            Quantitative CEFR tracking <br/>
            Hyper-personalized curriculum
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-12"
          >
            <button 
              onClick={onGetStarted}
              className="group relative px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-slate-900 dark:text-slate-50 text-lg font-bold rounded-2xl transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <div className="absolute -inset-2 bg-indigo-500/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 shadow-sm text-shadow">Start Free Assessment</span>
            </button>
          </motion.div>
        </header>

        {/* ── FEATURE GRID ── */}
        <section className="py-24 px-6 border-y border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-sm z-10 transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400 dark:text-indigo-400 uppercase tracking-[0.3em] mb-4">Precision Engine</h2>
              <h3 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-900 dark:text-slate-50">Engineered for Results.</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { 
                  icon: <Target className="w-8 h-8 text-rose-400" />, 
                  title: "Personalized Error Tracking", 
                  desc: "We don't just score you; we build an error profile from your speech to target remediation exactly where you fail.",
                  bg: "bg-rose-500/10"
                },
                { 
                  icon: <Mic className="w-8 h-8 text-indigo-400" />, 
                  title: "Speech Analysis", 
                  desc: "Gemini-powered evaluation of your pronunciation, fluency, and prosody. Get real native feedback.",
                  bg: "bg-indigo-500/10"
                },
                { 
                  icon: <BarChart3 className="w-8 h-8 text-emerald-400" />, 
                  title: "Detailed CEFR Reporting", 
                  desc: "Real-time mapping of your skills across global standards. Know your precise level from A1 to C2.",
                  bg: "bg-emerald-500/10"
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -10 }}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="p-10 rounded-[2.5rem] bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 hover:shadow-sm dark:shadow-md dark:hover:bg-white/[0.05] dark:hover:border-white/20 transition-all flex flex-col gap-6"
                >
                  <div className={`w-16 h-16 rounded-2xl ${feature.bg} flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-inner`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-50 mb-4">{feature.title}</h4>
                    <p className="text-slate-800 dark:text-slate-200 dark:text-slate-400 leading-relaxed font-light">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-32 px-6 scroll-mt-24 z-10">
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
                  <div className="shrink-0 w-12 h-12 bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-900 dark:text-slate-50 transition-all shadow-sm">
                    {point.icon}
                  </div>
                  <div>
                    <h5 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">{point.title}</h5>
                    <p className="text-slate-400 font-light">{point.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex-1 flex flex-col gap-8">
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-50 leading-tight">Beyond chat practice. <br/><span className="text-indigo-400">Structured growth.</span></h2>
              <p className="text-xl text-slate-400 leading-relaxed font-light">
                We replace aimless conversation with a deterministic learning loop. 
                Our engine measures your exact mastery of grammar and phonetics, then designs the perfect next lesson.
              </p>
              <div className="pt-4">
                 <button 
                   onClick={onGetStarted}
                   className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-900 dark:text-slate-50 rounded-2xl font-bold transition-all border border-white/10 inline-flex items-center gap-3 backdrop-blur-md"
                 >
                   Try the interactive demo <ArrowRight className="w-5 h-5 text-indigo-400" />
                 </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FOOTER ── */}
        <footer className="py-24 px-6 z-10">
          <div className="max-w-5xl mx-auto rounded-[3rem] p-12 md:p-24 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 text-center relative overflow-hidden backdrop-blur-xl border border-white/10 shadow-sm dark:shadow-md">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-slate-50 mb-8 tracking-tight leading-[1.1]">Stop Guessing. <br/>Start Mastering.</h2>
              <p className="text-indigo-200 text-lg max-w-xl mx-auto mb-12 font-light">
                Join thousands of learners identifying their true baseline today. Free to start, adaptive forever.
              </p>
              <button 
                onClick={onGetStarted}
                className="px-12 py-6 bg-white text-indigo-900 hover:bg-blue-50 dark:bg-blue-900/30 text-xl font-bold rounded-2xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] active:scale-95"
              >
                Start Assessment Now
              </button>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8 text-slate-500 font-medium">
             <div className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
               <BrainCircuit className="w-6 h-6 text-indigo-500" />
               <span className="text-xl font-bold tracking-tight">AI Tutor.</span>
             </div>
             <div className="flex gap-10 text-xs font-bold uppercase tracking-widest text-slate-500">
                <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Terms</a>
                <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Privacy</a>
                <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Whitepaper</a>
                <a href="#" className="hover:text-slate-900 dark:text-slate-50 transition-colors">Open Source</a>
             </div>
          </div>
        </footer>
      </FadeTransition>
    </div>
  );
};

export default LandingView;
