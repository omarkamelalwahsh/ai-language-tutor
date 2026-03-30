import React from 'react';
import { motion } from 'motion/react';
import { 
  Rocket, Sparkles, Target, Activity, 
  ChevronRight, ArrowRight, CheckCircle2,
  Route, Headphones, Mic, PenTool, BookOpen
} from 'lucide-react';
import { FadeTransition } from '../lib/animations';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const landingContent = {
  hero: {
    title: "Understand your English level and improve with a personalized learning journey.",
    subtitle: "Start with a short adaptive assessment, see your exact strengths and weaknesses, and follow a structured path designed for your performance.",
    ctaPrimary: "Start your journey",
    ctaSecondary: "Sign In"
  },
  steps: [
    { title: "Set up your profile", desc: "Select your learning goals, focus skills, and topics of interest." },
    { title: "Take a short adaptive assessment", desc: "Answer dynamic questions that change difficulty based on your performance." },
    { title: "Get your level and skill analysis", desc: "See your CEFR level broken down by speaking, writing, and listening." },
    { title: "Receive a personalized journey", desc: "Follow a tailored path built exactly for the gaps identified in your assessment." },
    { title: "Start learning step by step", desc: "Engage in targeted interactive tasks to build your proficiency." }
  ],
  features: [
    { icon: <Activity className="w-6 h-6" />, title: "Adaptive Assessment", desc: "Questions respond to your accuracy in real-time to find your true level." },
    { icon: <Target className="w-6 h-6" />, title: "Detailed Skill Breakdown", desc: "Deep analysis into speaking, writing, listening, and vocabulary mechanics." },
    { icon: <Route className="w-6 h-6" />, title: "Structured Progression", desc: "You aren't guessing what to learn next. A structured journey guides you." },
    { icon: <BookOpen className="w-6 h-6" />, title: "Interactive Tasks", desc: "Practice contextually with direct focus on your weak points." }
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
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-50/80 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/3" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-8 leading-[1.1] tracking-tight"
          >
            {landingContent.hero.title}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            {landingContent.hero.subtitle}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
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
              Sign In
            </button>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">How it works</h2>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">Follow a completely guided process—from the first question you see to the customized learning plan you receive.</p>
          </div>
          
          <div className="space-y-4">
            {landingContent.steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start md:items-center gap-6 p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-indigo-50/50 hover:border-indigo-100 transition-all"
              >
                <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-white rounded-full font-black text-indigo-600 border justify-self-start border-indigo-100 shadow-sm">
                  {i + 1}
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-lg font-bold text-slate-900 mb-1">{step.title}</h4>
                  <p className="text-slate-500 font-medium">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Real Features */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">What makes this different</h2>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">This is not a sandbox chatbot with random exercises. The platform drives your progress through structured tasks.</p>
          </div>
          
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-6"
          >
            {landingContent.features.map((f, i) => (
              <motion.div key={i} variants={staggerItem} className="p-8 rounded-[2rem] border border-slate-200 bg-white shadow-sm flex gap-6 items-start">
                <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
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

      {/* Final CTA */}
      <section className="py-24 px-6 bg-indigo-600 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white mb-8 tracking-tight">Ready to take your assessment?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onGetStarted}
              className="w-full sm:w-auto px-10 py-5 bg-white text-indigo-600 hover:bg-slate-50 text-lg font-bold rounded-2xl shadow-lg transition-all"
            >
              Start your journey
            </button>
          </div>
        </div>
      </section>

    </FadeTransition>
  );
};
