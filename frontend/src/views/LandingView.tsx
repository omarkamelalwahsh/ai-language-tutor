import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, ArrowRight, BrainCircuit, Mic, BarChart3, Globe,
  CheckCircle, MessageSquare, Star, BookOpen, ChevronDown, Play,
  Menu, X
} from 'lucide-react';
import { FadeTransition } from '../lib/animations';
import ThemeToggle from '../components/ThemeToggle';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onGetStarted, onSignIn }) => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 overflow-x-hidden selection:bg-teal-500/30 font-sans relative transition-colors duration-300">
      
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
           className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-teal-500/20 rounded-full blur-[160px]" 
         />
         <motion.div 
           animate={{ opacity: [0.15, 0.25, 0.15] }}
           transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
           className="absolute top-[20%] left-[20%] w-[50vw] h-[50vw] bg-blue-600 dark:bg-blue-600/30 rounded-full blur-[160px]" 
         />
         <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PScwIDAgMjAwIDIwMCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZmlsdGVyIGlkPSdub2lzZUZpbHRlcic+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuNjUnIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWx0ZXI9J3VybCgjbm9pc2VGaWx0ZXIpJy8+PC9zdmc+')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <FadeTransition className="relative z-10 flex flex-col min-h-screen">
        {/* ── GLASS NAVBAR ── */}
        <nav className="w-full pt-6 md:pt-8 px-4 flex justify-center z-50">
          <div className="w-full max-w-6xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-3xl px-6 md:px-8 py-4 flex items-center justify-between shadow-premium dark:shadow-md transition-colors duration-300">
            
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xl tracking-tight">
               AI Tutor
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500 dark:text-zinc-400">
               <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-slate-900 dark:hover:text-zinc-50 transition-colors">How It Works</a>
               <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-slate-900 dark:hover:text-zinc-50 transition-colors">Features</a>
               <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="hover:text-slate-900 dark:hover:text-zinc-50 transition-colors">Pricing</a>
               <a href="#docs" onClick={(e) => scrollToSection(e, 'docs')} className="hover:text-slate-900 dark:hover:text-zinc-50 transition-colors">Docs</a>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
              <ThemeToggle />
              <button onClick={onSignIn} className="hidden md:block text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50 transition-colors">
                Log in
              </button>
              <button onClick={onGetStarted} className="hidden md:block px-4 py-2 md:px-5 md:py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-xl transition-all shadow-sm">
                Start Free Assessment
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </nav>

        {/* ── MOBILE MENU OVERLAY ── */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 z-[60] bg-white dark:bg-zinc-950 flex flex-col p-6 md:hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xl tracking-tight">
                   AI Tutor
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex flex-col gap-6 text-lg font-medium text-slate-700 dark:text-zinc-300">
                <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')}>How It Works</a>
                <a href="#features" onClick={(e) => scrollToSection(e, 'features')}>Features</a>
                <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')}>Pricing</a>
                <a href="#docs" onClick={(e) => scrollToSection(e, 'docs')}>Docs</a>
              </div>
              <div className="mt-auto flex flex-col gap-4">
                <button onClick={() => { setIsMobileMenuOpen(false); onSignIn(); }} className="w-full py-4 bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-white font-bold rounded-2xl">
                  Log in
                </button>
                <button onClick={() => { setIsMobileMenuOpen(false); onGetStarted(); }} className="w-full py-4 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-2xl">
                  Start Free Assessment
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO SECTION ── */}
        <header className="flex flex-col items-center pt-24 md:pt-32 pb-24 md:pb-32 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-300 text-sm font-medium mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Language Learning</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white max-w-4xl leading-[1.1]"
          >
            Stop Guessing. <br className="hidden md:block" />
            <span className="text-teal-500">Start Mastering.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="mt-6 md:mt-8 text-lg md:text-xl text-slate-500 dark:text-zinc-400 max-w-2xl font-light leading-relaxed"
          >
            Assess your level, identify key gaps, and follow a tailored path to measurable progress.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="mt-10 flex flex-col md:flex-row items-center gap-4 w-full md:w-auto"
          >
            <button 
              onClick={onGetStarted}
              className="w-full md:w-auto group relative px-8 py-4 bg-teal-500 hover:bg-teal-600 text-white text-lg font-bold rounded-2xl transition-all overflow-hidden shadow-sm hover:shadow-md"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                Start Free Assessment <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button 
              onClick={(e) => scrollToSection(e as any, 'how-it-works')}
              className="w-full md:w-auto px-8 py-4 bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 text-slate-900 dark:text-white text-lg font-bold rounded-2xl transition-all border border-slate-200 dark:border-zinc-700 flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <Play className="w-5 h-5" /> See How It Works
            </button>
          </motion.div>
        </header>

        {/* ── HOW IT WORKS (3-STEP JOURNEY) ── */}
        <section id="how-it-works" className="py-16 md:py-32 px-6 scroll-mt-24 z-10 bg-white/40 dark:bg-zinc-900/40 border-y border-slate-200 dark:border-zinc-800/50 backdrop-blur-md">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 md:mb-24">
              <h2 className="text-sm font-bold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] mb-3">Your Journey</h2>
              <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white">How It Works</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12 relative">
              {/* Desktop connecting line */}
              <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-teal-500/0 via-teal-500/30 to-teal-500/0 z-0" />

              {[
                { 
                  step: "01",
                  title: "Take Your Free Assessment", 
                  desc: "Complete a quick 5-minute AI-driven test to accurately gauge your current CEFR level.",
                  icon: <Target className="w-6 h-6" />
                },
                { 
                  step: "02",
                  title: "Get Your Learning Path", 
                  desc: "Receive a personalized roadmap based on your results, targeting specific weaknesses.",
                  icon: <Map className="w-6 h-6" />
                },
                { 
                  step: "03",
                  title: "Practice & Track Progress", 
                  desc: "Engage with adaptive exercises and get real-time feedback to monitor your journey.",
                  icon: <BarChart3 className="w-6 h-6" />
                }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2, duration: 0.6 }}
                  className="relative z-10 flex flex-col items-center text-center group"
                >
                  <div className="w-24 h-24 rounded-full bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 shadow-premium dark:shadow-md flex items-center justify-center mb-6 relative group-hover:border-teal-500 transition-colors duration-300">
                    <span className="absolute -top-3 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">Step {item.step}</span>
                    <div className="text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform duration-300">
                      {item.icon}
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h4>
                  <p className="text-slate-500 dark:text-zinc-400 font-light leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SUPPORTED LANGUAGES ── */}
        <section className="py-16 md:py-24 px-6 z-10 bg-slate-50/50 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-zinc-800/50">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Choose the language you speak and the language you want to learn.</h3>
            <p className="text-slate-500 dark:text-zinc-400 mb-10 text-lg font-light">Start with English, with more options coming soon.</p>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="px-8 py-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-teal-500/30 flex items-center gap-3">
                 <Globe className="w-6 h-6 text-teal-500" />
                 <span className="font-bold text-lg text-slate-900 dark:text-white">English</span>
              </div>
              <div className="px-8 py-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 flex items-center gap-3 opacity-60">
                 <Globe className="w-6 h-6 text-slate-400" />
                 <span className="font-bold text-lg text-slate-500 dark:text-zinc-400">Spanish <span className="text-xs ml-2 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-full">Soon</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* ── ENHANCED FEATURE GRID ── */}
        <section id="features" className="py-16 md:py-32 px-6 scroll-mt-24 z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <h2 className="text-sm font-bold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] mb-3">Core Skills</h2>
              <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white">Master Every Aspect</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <motion.div 
                whileHover={{ y: -5 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:col-span-2 p-8 md:p-10 rounded-[2rem] bg-gradient-to-br from-teal-500/5 to-blue-500/5 dark:from-teal-500/10 dark:to-blue-500/10 border border-teal-200 dark:border-teal-500/20 shadow-sm transition-all duration-300 flex flex-col md:flex-row gap-6 items-start"
              >
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-inner">
                  <Target className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Personalized Learning Path</h4>
                  <p className="text-slate-600 dark:text-zinc-300 leading-relaxed font-light text-lg">Get lessons that adapt to your goals, level, and weak points.</p>
                </div>
              </motion.div>

              {[
                { 
                  icon: <BookOpen className="w-8 h-8 text-blue-500" />, 
                  title: "Grammar Practice", 
                  desc: "Targeted exercises to build strong language foundations and correct common mistakes.",
                },
                { 
                  icon: <MessageSquare className="w-8 h-8 text-green-500" />, 
                  title: "Vocabulary Growth", 
                  desc: "Expand your active vocabulary with context-driven learning and spaced repetition.",
                },
                { 
                  icon: <Mic className="w-8 h-8 text-purple-500" />, 
                  title: "Speaking Feedback", 
                  desc: "Real-time analysis of your pronunciation and fluency for native-like speech.",
                },
                { 
                  icon: <BarChart3 className="w-8 h-8 text-amber-500" />, 
                  title: "Progress Tracking", 
                  desc: "Monitor your journey from A1 to C2 with precise, CEFR-aligned data.",
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="p-8 md:p-10 rounded-[2rem] bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-xl dark:shadow-none dark:hover:bg-zinc-800/80 transition-all duration-300 flex flex-col md:flex-row gap-6 items-start"
                >
                  <div className={`shrink-0 w-16 h-16 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center border border-slate-100 dark:border-zinc-700 shadow-inner`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h4>
                    <p className="text-slate-500 dark:text-zinc-400 leading-relaxed font-light">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUST & SOCIAL PROOF ── */}
        <section className="py-16 md:py-32 px-6 bg-slate-100/50 dark:bg-zinc-900/30 border-y border-slate-200 dark:border-zinc-800/50 z-10">
          <div className="max-w-6xl mx-auto space-y-24">
            
            {/* CEFR Info Block */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="p-8 md:p-12 rounded-[2.5rem] bg-gradient-to-br from-teal-500 to-blue-600 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl"
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="w-8 h-8 opacity-80" />
                  <h3 className="text-3xl font-bold">Global Standards</h3>
                </div>
                <p className="text-teal-50 text-lg max-w-2xl font-light">
                  Track your level from A1 to C2 using CEFR-aligned progress indicators.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2 font-black text-2xl bg-white/10 px-6 py-4 rounded-2xl backdrop-blur-sm border border-white/20">
                A1 <ArrowRight className="w-5 h-5 opacity-50" /> C2
              </div>
            </motion.div>

            {/* Testimonials */}
            <div>
              <div className="text-center mb-12">
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">What Learners Are Saying</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                    <div className="flex gap-1 text-amber-400 mb-4">
                      {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}
                    </div>
                    <p className="text-slate-500 dark:text-zinc-400 italic mb-6">"Testimonial placeholder text. Waiting for real user reviews to populate this section."</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800" />
                      <div>
                        <div className="h-4 w-24 bg-slate-200 dark:bg-zinc-800 rounded mb-1" />
                        <div className="h-3 w-16 bg-slate-100 dark:bg-zinc-800/50 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING SECTION ── */}
        <section id="pricing" className="py-16 md:py-32 px-6 scroll-mt-24 z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <h2 className="text-sm font-bold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] mb-3">Pricing</h2>
              <h3 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white">Simple, Transparent Plans</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { name: "Free Assessment", price: "$0", desc: "Assessment Only", features: ["1 Initial Assessment", "CEFR Level Result", "Basic Error Profile"] },
                { name: "Monthly Plan", price: "$19", period: "/mo", desc: "Standard Path", popular: true, features: ["Unlimited Lessons", "Grammar & Vocab", "Progress Tracking", "Email Support"] },
                { name: "Premium Tutor Plan", price: "$49", period: "/mo", desc: "Unlimited AI Speaking", features: ["Everything in Monthly", "Unlimited Speech Analysis", "Native Prosody Feedback", "Priority Support"] },
              ].map((plan, i) => (
                <div key={i} className={`relative p-8 rounded-[2.5rem] bg-white dark:bg-zinc-900 border ${plan.popular ? 'border-teal-500 shadow-teal-500/10 shadow-2xl' : 'border-slate-200 dark:border-zinc-800 shadow-sm'} flex flex-col hover:-translate-y-2 transition-transform duration-300`}>
                  {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
                      Most Popular
                    </div>
                  )}
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h4>
                  <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">{plan.desc}</p>
                  <div className="mb-8 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-500 dark:text-zinc-400">{plan.period}</span>}
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-slate-600 dark:text-zinc-300">
                        <CheckCircle className="w-4 h-4 text-teal-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={onGetStarted} className={`w-full py-3 rounded-xl font-bold transition-all ${plan.popular ? 'bg-teal-500 hover:bg-teal-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-white'}`}>
                    Get Started
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ SECTION ── */}
        <section className="py-16 md:py-24 px-6 z-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Frequently Asked Questions</h3>
            </div>
            
            <div className="space-y-4">
              {[
                { q: "What languages are supported?", a: "Currently, we focus on English. Spanish and French are coming soon." },
                { q: "What is CEFR?", a: "The Common European Framework of Reference for Languages (CEFR) is an international standard for describing language ability. We track your level from A1 (Beginner) to C2 (Mastery)." },
                { q: "Is the assessment truly free?", a: "Yes, your initial comprehensive assessment to gauge your current level is 100% free." },
                { q: "How does the speaking analysis work?", a: "Our AI tutor uses advanced speech recognition and natural language processing to evaluate your pronunciation, fluency, and grammar in real-time." },
                { q: "Is my privacy protected?", a: "Absolutely. We do not share your voice data or personal information with any third parties." }
              ].map((faq, i) => (
                <div key={i} className="border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/50 overflow-hidden">
                  <button 
                    onClick={() => toggleFAQ(i)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left text-lg font-medium text-slate-900 dark:text-white focus:outline-none"
                  >
                    {faq.q}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFAQ === i ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openFAQ === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="px-6 pb-5 text-slate-500 dark:text-zinc-400 text-left">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DOCS SECTION ── */}
        <section id="docs" className="py-16 md:py-24 px-6 z-10 border-t border-slate-200 dark:border-zinc-800/50">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Documentation</h3>
            <p className="text-slate-500 dark:text-zinc-400 mb-8 font-light">Read our detailed guides on how to make the most out of your AI Tutor.</p>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
               <BookOpen className="w-5 h-5" /> Coming Soon
            </div>
          </div>
        </section>

        {/* ── CTA FOOTER ── */}
        <footer className="py-16 md:py-24 px-6 z-10">
          <div className="max-w-5xl mx-auto rounded-[3rem] p-10 md:p-24 bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:to-teal-900/20 text-center relative overflow-hidden backdrop-blur-xl border border-slate-200 dark:border-zinc-800 shadow-premium dark:shadow-md">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">Stop Guessing. Start Mastering.</h2>
              <p className="text-slate-500 dark:text-zinc-400 text-lg max-w-xl mx-auto mb-10 font-light">
                Assess your level, identify key gaps, and follow a tailored path to measurable progress.
              </p>
              <button 
                onClick={onGetStarted}
                className="px-10 py-5 bg-teal-500 hover:bg-teal-600 text-white text-xl font-bold rounded-2xl transition-all shadow-premium hover:shadow-xl hover:-translate-y-1 active:scale-95"
              >
                Start Free Assessment
              </button>
            </div>
          </div>
          
          <div className="max-w-6xl mx-auto mt-20 pt-8 border-t border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500">
             <div className="flex items-center gap-2 text-slate-900 dark:text-white">
               <BrainCircuit className="w-6 h-6 text-teal-500" />
               <span className="text-xl font-bold tracking-tight">AI Tutor.</span>
             </div>
             <div className="flex flex-wrap justify-center gap-8 text-sm font-medium">
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</a>
             </div>
          </div>
        </footer>
      </FadeTransition>
    </div>
  );
};

// Required missing icons from lucide-react not imported at top
function Sparkles(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function Map(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" x2="9" y1="3" y2="18" />
      <line x1="15" x2="15" y1="6" y2="21" />
    </svg>
  );
}

export default LandingView;
