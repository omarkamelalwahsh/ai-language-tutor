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
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { BatterySelector, BatteryQuestion } from '../../engine/selector/AdaptiveSelector';

interface PlacementOnboardingProps {
  onComplete?: (battery: BatteryQuestion[]) => void;
}

export const PlacementOnboarding: React.FC<PlacementOnboardingProps> = ({ onComplete }) => {
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 flex">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`h-full transition-all duration-500 ${step >= s ? 'bg-blue-600' : 'bg-transparent'}`} 
              style={{ width: '25%' }} 
            />
          ))}
        </div>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: -20 }} 
                key="s1"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                  <ShieldCheck size={24} />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-6">Welcome to your English placement test</h1>
                <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                  This comprehensive assessment measures your current English level across speaking, writing, reading, and listening. 
                  Your result will help us build the best learning journey for you.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 mb-8">
                  <ShieldCheck className="text-blue-600 shrink-0 mt-1" size={18} />
                  <p className="text-sm text-blue-800">Takes about 20-30 minutes. Answer honestly for the most accurate result.</p>
                </div>
                <button 
                  onClick={nextStep} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
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
                <h2 className="text-2xl font-bold text-slate-900 mb-6">How your level is determined</h2>
                <div className="space-y-4 text-slate-600 mb-8 leading-relaxed">
                  <p>Your score is based on the English you actually demonstrate during the test.</p>
                  <p>To receive a high level (B2+), your answers must show advanced vocabulary, grammar, and language control.</p>
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-5 mt-6 rounded-r-lg">
                    <p className="text-amber-900 font-medium text-sm">
                      Using very short, simple, or incomplete answers may lower your result, even if your actual level is higher.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={nextStep} 
                  className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-semibold transition-all"
                >
                  Got it
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
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Answering rules</h2>
                <ul className="space-y-4 mb-8">
                  {[
                    'Answer on your own', 
                    'Use English only', 
                    'Write and speak in full, natural answers', 
                    'Read and listen carefully'
                  ].map((rule, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                      <CheckCircle className="text-green-500 w-5 h-5 flex-shrink-0" /> {rule}
                    </li>
                  ))}
                </ul>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex gap-3 mb-8">
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-800 font-medium leading-tight">
                    Do not use AI tools, translators, or copied answers. Assisted answers lead to an unsuitable learning path.
                  </p>
                </div>
                <button 
                  onClick={nextStep} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold transition-all"
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
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Show your best in every skill</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <SkillCard icon={<PenTool size={18} />} title="Writing" desc="Use full sentences." />
                  <SkillCard icon={<Mic size={18} />} title="Speaking" desc="Speak clearly and fully." />
                  <SkillCard icon={<BookOpen size={18} />} title="Reading" desc="Read with focus." />
                  <SkillCard icon={<Headphones size={18} />} title="Listening" desc="Use headphones." />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl mb-8 border border-slate-100 italic text-slate-500 text-xs text-center">
                  "The height of your achievements is determined by the depth of your focus."
                </div>

                <button 
                  onClick={handleStartTest} 
                  disabled={isFetching && !battery}
                  className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg ${
                    isFetching && !battery
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-green-100'
                  }`}
                >
                  {isFetching && !battery ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Preparing your battery...
                    </>
                  ) : (
                    <>
                      Start placement test
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
  <div className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex items-center gap-4 hover:border-blue-200 transition-colors">
    <div className="p-2.5 bg-white rounded-lg shadow-sm text-blue-600">{icon}</div>
    <div>
      <h4 className="font-bold text-slate-800 text-sm leading-none mb-1">{title}</h4>
      <p className="text-[10px] text-slate-500 font-medium">{desc}</p>
    </div>
  </div>
);
