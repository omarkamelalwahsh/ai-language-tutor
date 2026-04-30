import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  Mic, 
  PenTool, 
  BookOpen, 
  Headphones, 
  AlertTriangle, 
  ShieldCheck,
  Loader2,
  ChevronRight,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { BatterySelector, BatteryQuestion } from '../../engine/selector/AdaptiveSelector';

interface PlacementOnboardingProps {
  onComplete?: (battery: BatteryQuestion[]) => void;
}

const PlacementOnboarding: React.FC<PlacementOnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { user } = useData();
  
  // Pre-fetching state
  const [battery, setBattery] = useState<BatteryQuestion[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const startPreFetch = async () => {
    if (isFetching || battery) return;
    setIsFetching(true);
    try {
      console.log("[Onboarding] Starting background battery pre-fetch...");
      const result = await BatterySelector.fetchAndBuild(user?.id || "");
      setBattery(result);
    } catch (err) {
      console.error("[Onboarding] Pre-fetch failed:", err);
      setFetchError("Failed to prepare test questions. We'll try again when you start.");
    } finally {
      setIsFetching(false);
    }
  };

  // Trigger pre-fetch on Step 3
  useEffect(() => {
    if (step === 3) {
      startPreFetch();
    }
  }, [step]);

  const nextStep = () => setStep((prev) => prev + 1);

  const handleStartTest = () => {
    if (onComplete && battery) {
      onComplete(battery);
    } else {
      // If battery is still loading, DiagnosticView will handle it via its own lazy fetch
      // but we prefer passing it via state to avoid double-fetching.
      navigate('/diagnostic', { state: { preFetchedBattery: battery } });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 font-sans transition-colors duration-300 relative">
      
      {/* Exit Button */}
      <button 
        onClick={async () => {
          const { supabase } = await import('../../lib/supabaseClient');
          await supabase.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/auth';
        }}
        className="fixed top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-rose-500 transition-colors font-black uppercase tracking-widest text-[10px] bg-white dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-transparent shadow-sm z-50"
      >
        <X size={14} /> Exit & Logout
      </button>

      <div className="max-w-2xl w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm dark:shadow-md overflow-hidden border border-slate-200 dark:border-gray-800">
        
        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-slate-50 dark:bg-gray-900">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assessment Onboarding</span>
          <span className="text-xs font-bold text-slate-500">Step {step} of 4</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-gray-800 flex">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`h-full transition-all duration-500 ${step >= s ? 'bg-blue-600' : 'bg-transparent'}`} 
              style={{ width: '25%' }} 
            />
          ))}
        </div>

        <div className="p-6 md:p-8 lg:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: -20 }} 
                key="s1"
              >
                <div className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">Step 1: Overview</div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-6">Your English Level Assessment Starts Here</h1>
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Your score reflects the English you demonstrate. Higher levels require strong vocabulary, grammar, and control.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 mb-8">
                  <ShieldCheck className="text-blue-600 shrink-0 mt-1" size={18} />
                  <p className="text-sm text-blue-800">There are no penalties — just answer naturally.</p>
                </div>
                <button 
                  onClick={nextStep} 
                  className="w-full md:w-auto md:min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
                >
                  Continue
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: -20 }} 
                key="s2"
              >
                <div className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">Step 2: Scoring</div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">How your level is determined</h2>
                <div className="space-y-4 text-base md:text-lg text-slate-600 mb-8 leading-relaxed">
                  <p>Your score is based on the English you actually demonstrate during the test.</p>
                  <p>To receive a high level (B2+), your answers must show advanced vocabulary, grammar, and language control.</p>
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-5 mt-6 rounded-r-lg">
                    <p className="text-amber-900 font-medium text-sm">
                      Short or incomplete answers may lower your score — even if your level is higher.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={nextStep} 
                  className="w-full md:w-auto md:min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 rounded-xl font-semibold transition-all"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: -20 }} 
                key="s3"
              >
                <div className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">Step 3: Rules</div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">How to answer</h2>
                <ul className="space-y-4 mb-8">
                  {[
                    'Answer independently', 
                    'Use English only', 
                    'Respond in full sentences', 
                    'Read and listen carefully'
                  ].map((rule, i) => (
                    <li key={i} className="flex items-center gap-3 text-base md:text-lg text-slate-700 font-medium">
                      <CheckCircle className="text-green-500 w-5 h-5 flex-shrink-0" /> {rule}
                    </li>
                  ))}
                </ul>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex gap-3 mb-8">
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-800 font-medium leading-tight">
                    Avoid using AI tools, translators, or copied answers to ensure accurate results.
                  </p>
                </div>
                <button 
                  onClick={nextStep} 
                  className="w-full md:w-auto md:min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white py-4 px-8 rounded-xl font-semibold transition-all"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: -20 }} 
                key="s4"
              >
                <div className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">Step 4: Final Review</div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6">Demonstrate your ability across all core skills.</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <SkillCard icon={<PenTool size={18} />} title="Writing" desc="Use full sentences." />
                  <SkillCard icon={<Mic size={18} />} title="Speaking" desc="Speak clearly and fully." />
                  <SkillCard icon={<BookOpen size={18} />} title="Reading" desc="Read with focus." />
                  <SkillCard icon={<Headphones size={18} />} title="Listening" desc="Use headphones if possible." />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100 text-slate-600 text-sm text-center font-medium">
                  Your results will shape your personalized learning path.
                </div>

                <p className="text-center font-bold text-slate-800 mb-8">You're ready. Let's begin your assessment.</p>

                <button 
                  onClick={handleStartTest} 
                  disabled={isFetching && !battery}
                  className={`w-full md:w-auto md:min-w-[250px] py-4 px-8 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg mx-auto ${
                    isFetching && !battery
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                >
                  {isFetching && !battery ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Preparing your battery...
                    </>
                  ) : (
                    <>
                      Start Assessment
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
                
                {fetchError && (
                  <p className="text-center text-red-500 text-xs mt-4 font-medium italic">
                    {fetchError}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const SkillCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex items-center gap-4 hover:border-blue-200 transition-colors w-full">
    <div className="p-2.5 bg-white rounded-lg shadow-sm text-blue-600">{icon}</div>
    <div>
      <h4 className="font-bold text-slate-800 text-sm md:text-base leading-none mb-1">{title}</h4>
      <p className="text-xs md:text-sm text-slate-500 font-medium">{desc}</p>
    </div>
  </div>
);

export default PlacementOnboarding;
