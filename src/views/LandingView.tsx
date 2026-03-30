import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Target, Activity, 
  ChevronRight, ArrowRight, CheckCircle2,
  Route, BookOpen, LineChart, ShieldCheck,
  BrainCircuit, LayoutDashboard
} from 'lucide-react';
import { FadeTransition } from '../lib/animations';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const landingContent = {
  hero: {
    title: "Quantify your English. Follow a guided path to fluency.",
    subtitle: "Take a dynamic assessment to pinpoint your exact skill gaps, then progress through a structured learning journey built around your real-time performance.",
    ctaPrimary: "Start Your Assessment",
    ctaSecondary: "Sign In"
  },
  steps: [
    { title: "Set your baseline", desc: "Define your core goals and focus areas." },
    { title: "Take the adaptive assessment", desc: "Answer dynamic questions that calibrate precisely to your level." },
    { title: "Review your skill breakdown", desc: "See your CEFR level isolated across speaking, writing, and listening." },
    { title: "Unlock your custom journey", desc: "Receive a step-by-step path targeting your exact weaknesses." },
    { title: "Start learning", desc: "Engage with interactive tasks that evolve as you improve." }
  ],
  features: [
    { icon: <Activity className="w-6 h-6" />, title: "Adaptive Assessment", desc: "Questions instantly shift in difficulty based on your accuracy, locking in your true proficiency level faster." },
    { icon: <Target className="w-6 h-6" />, title: "Detailed Skill Breakdown", desc: "Stop guessing where you struggle; get granular analytics on your speaking, writing, and listening mechanics." },
    { icon: <Route className="w-6 h-6" />, title: "Structured Progression", desc: "Eliminate decision fatigue with a clear, sequential path formulated specifically for your exact gaps." },
    { icon: <BookOpen className="w-6 h-6" />, title: "Interactive Tasks", desc: "Practice in-context with targeted exercises designed to fix errors directly rather than just repeating vocabulary." }
  ],
  trustFeatures: [
    { icon: <LineChart className="w-5 h-5 text-emerald-600" />, bg: "bg-emerald-50", border: "border-emerald-100", title: "Data-Driven Progression", desc: "Every step forward is dictated by your performance data, ensuring you never waste time on material that is too easy or impossibly hard." },
    { icon: <Target className="w-5 h-5 text-indigo-600" />, bg: "bg-indigo-50", border: "border-indigo-100", title: "Targeted Remediation", desc: "Instead of random quizzes, tasks are actively pulled to reinforce the specific skills your assessment flagged as fragile." },
    { icon: <ShieldCheck className="w-5 h-5 text-amber-600" />, bg: "bg-amber-50", border: "border-amber-100", title: "Measurable Milestones", desc: "Watch your proficiency increase structurally; you always know exactly what you need to master before advancing to the next level." }
  ]
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const LandingView: React.FC<LandingViewProps> = ({ onGetStarted, onSignIn }) => {
  return (
    <FadeTransition className="min-h-screen bg-slate-50 overflow-x-hidden pt-20">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
               <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">AI Language Tutor.</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onSignIn}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={onGetStarted}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-50/80 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-50/80 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/3" />
        
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 relative z-10">
          <div className="flex-1 text-left">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 leading-[1.1] tracking-tight"
            >
              Quantify your English. Follow a guided path to fluency.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-slate-500 mb-10 max-w-2xl leading-relaxed font-medium"
            >
              {landingContent.hero.subtitle}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <button 
                onClick={onGetStarted}
                className="w-full sm:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 group"
              >
                {landingContent.hero.ctaPrimary} <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={onSignIn}
                className="w-full sm:w-auto px-10 py-5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-lg font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3"
              >
                {landingContent.hero.ctaSecondary}
              </button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
            className="flex-1 w-full lg:max-w-md hidden md:block"
          >
            {/* Minimal Dashboard Preview Graphic */}
            <div className="bg-white p-6 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 translate-x-4 lg:translate-x-0 relative rotate-1 hover:rotate-0 transition-transform duration-500">
               <div className="flex justify-between items-center mb-6">
                 <div className="font-bold text-slate-800">Skill Breakdown</div>
                 <div className="text-xl font-extrabold text-indigo-600">B2</div>
               </div>
               <div className="space-y-4">
                 {[ 
                   { label: "Speaking", v: "75%", bg: "bg-indigo-500" }, 
                   { label: "Listening", v: "82%", bg: "bg-emerald-500" }, 
                   { label: "Writing", v: "60%", bg: "bg-amber-500" } 
                 ].map(s => (
                   <div key={s.label}>
                     <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                       <span>{s.label}</span><span>{s.v}</span>
                     </div>
                     <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className={`h-full ${s.bg}`} style={{width: s.v}} />
                     </div>
                   </div>
                 ))}
               </div>
               <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3 bg-indigo-50/50 p-4 rounded-xl text-indigo-900 border border-indigo-100">
                 <Route className="w-5 h-5 shrink-0" />
                 <span className="text-sm font-bold">Next path: Improve writing structure</span>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">A structured approach from day one.</h2>
            <p className="text-slate-500 font-medium max-w-xl text-lg">Experience a guided progression that adapts to your proficiency at every step.</p>
          </div>
          
          <div className="space-y-4 relative">
            <div className="absolute left-[35px] top-6 bottom-6 w-0.5 bg-slate-100 z-0 hidden md:block" />
            {landingContent.steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start md:items-center gap-6 p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all relative z-10 hover:shadow-lg shadow-indigo-100/20"
              >
                <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-white rounded-full font-black text-indigo-600 border border-slate-200 shadow-sm relative z-10">
                  {i + 1}
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-xl font-bold text-slate-900 mb-1">{step.title}</h4>
                  <p className="text-slate-500 font-medium">{step.desc}</p>
                </div>
                {i !== landingContent.steps.length -1 && <div className="hidden md:block w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100"><ArrowRight className="w-4 h-4"/></div>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Real Features */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Precision learning tools.</h2>
            <p className="text-slate-500 font-medium text-lg max-w-xl">Every feature is designed to accurately read your states and deliver the optimal curriculum forward.</p>
          </div>
          
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-6"
          >
            {landingContent.features.map((f, i) => (
              <motion.div key={i} variants={staggerItem} className="p-8 rounded-[2rem] border border-slate-200 bg-white shadow-sm flex gap-6 items-start hover:-translate-y-1 transition-transform group">
                <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* DIFFERENTIATION SECTION */}
      <section className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-16 relative z-10">
          <div className="flex-1">
            <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 tracking-tight">Beyond chat-based practice.</h2>
            <p className="text-xl text-slate-300 leading-relaxed font-medium max-w-xl">
              Unstructured conversations don't build measurable fluency. Rather than leaving you in an open-ended sandbox with random exercises, our platform acts as an engine that actively drives your progression. 
            </p>
            <p className="text-lg text-slate-400 mt-6 leading-relaxed font-medium max-w-xl">
              Every task you complete feeds into a deterministic cycle that measures your growth and constructs the immediate next step.
            </p>
          </div>
          
          <div className="flex-1 w-full bg-slate-800/50 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-4 h-full">
               <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 flex flex-col justify-center items-center text-center opacity-60">
                 <BrainCircuit className="w-10 h-10 text-slate-500 mb-4" />
                 <p className="font-bold text-slate-400 mb-2">Aimless Practice</p>
                 <p className="text-xs font-medium text-slate-500">Endless varied tasks, no tracking, no direction.</p>
               </div>
               <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/30 flex flex-col justify-center items-center text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/20 to-transparent" />
                 <Route className="w-10 h-10 text-indigo-400 mb-4 relative z-10" />
                 <p className="font-bold text-indigo-100 mb-2 relative z-10">Structured Path</p>
                 <p className="text-xs font-medium text-indigo-200/80 relative z-10">Data-driven progression tailored to closing gaps.</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="py-24 px-6 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start gap-16">
          <div className="md:w-1/3">
             <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Why this model works.</h2>
             <p className="text-slate-500 text-lg font-medium leading-relaxed mb-8">Fluency is achieved through intentional repetition, not endless content.</p>
             <div className="w-24 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
               <div className="w-12 h-full bg-indigo-600 rounded-full" />
             </div>
          </div>
          <div className="md:w-2/3 space-y-6">
            {landingContent.trustFeatures.map((t, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-6 items-start bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className={`p-4 rounded-xl ${t.bg} border ${t.border} shrink-0`}>
                  {t.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{t.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 bg-slate-50 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Stop guessing your level. <br/><span className="text-indigo-600">Start improving it.</span></h2>
          <p className="text-xl text-slate-500 font-medium mb-10 max-w-xl mx-auto">Discover your true baseline and begin your personalized journey today.</p>
          <button 
            onClick={onGetStarted}
            className="w-full sm:w-auto px-12 py-6 bg-indigo-600 hover:bg-slate-900 text-white text-xl font-bold rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 mx-auto"
          >
            Take Your Free Assessment <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

    </FadeTransition>
  );
};
