import React from 'react';
import { CheckCircle2, XCircle, Lightbulb, Search, MessageSquare, Target } from 'lucide-react';

interface Question {
  id: string | number;
  question_number?: number;
  skill_tested: string; // Aligned with AI JSON
  user_answer: string;
  correct_answer: string;
  result: 'Correct' | 'Incorrect' | string; // Aligned with AI JSON
  ai_interpretation: string;
  what_it_tells_us: string; // Aligned with AI JSON
}

interface QuestionReviewProps {
  questions?: Question[];
}

const QuestionAnalysis: React.FC<QuestionReviewProps> = ({ questions }) => {
  const [filter, setFilter] = React.useState<string>('All');
  
  // داتا تجريبية لو الـ Props لسه مش جاهزة
  const sampleQuestions: Question[] = questions || [
    {
      id: "q-1",
      question_number: 1,
      skill_tested: "Reading/Vocabulary",
      user_answer: "airport",
      correct_answer: "airport",
      result: "Correct",
      ai_interpretation: "You correctly used context to identify a common everyday word. This suggests solid recognition of high-frequency vocabulary in practical situations.",
      what_it_tells_us: "You are comfortable with familiar vocabulary when the context is clear."
    },
    {
      id: "q-2",
      question_number: 2,
      skill_tested: "Grammar",
      user_answer: "He go to work every day",
      correct_answer: "He goes to work every day",
      result: "Incorrect",
      ai_interpretation: "You communicated the meaning successfully, but the verb form was incorrect. This suggests that basic subject-verb agreement is not yet fully automatic.",
      what_it_tells_us: "You can express simple ideas, but grammar accuracy still needs strengthening."
    }
  ];

  const categories = ['All', ...Array.from(new Set(sampleQuestions.map(q => q.skill_tested)))];
  const filteredQuestions = filter === 'All' 
    ? sampleQuestions 
    : sampleQuestions.filter(q => q.skill_tested === filter);

  return (
    <div id="question-analysis" className="space-y-8 animate-in fade-in duration-700 scroll-mt-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div className="flex items-center gap-3">
          <Search className="text-indigo-600" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Step-by-Step Analysis</h2>
        </div>
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
           {categories.map(cat => (
             <button
               key={cat}
               onClick={() => setFilter(cat)}
               className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 ${
                 filter === cat 
                   ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                   : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
               }`}
             >
               {cat}
             </button>
           ))}
        </div>
      </div>

      <div className="grid gap-6">
        {filteredQuestions.map((q, idx) => {
          const isCorrect = q.result === 'Correct';
          return (
            <div key={idx} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-xl transition-all border-l-4 group" 
                 style={{ borderLeftColor: isCorrect ? '#10b981' : '#f43f5e' }}>
              
              <div className="p-6">
                {/* Header: Question Metadata */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Question {q.question_number || idx + 1}</span>
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">{q.skill_tested}</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {isCorrect ? 'Mastered' : 'Needs Review'}
                  </div>
                </div>

                {/* Answers Comparison */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Your Submission</span>
                    <p className={`font-bold ${isCorrect ? 'text-slate-700' : 'text-rose-600'}`}>{q.user_answer || "No answer"}</p>
                  </div>
                  {!isCorrect && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100/50 transition-colors">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase block mb-1">Correct Pattern</span>
                      <p className="font-bold text-emerald-700 italic">"{q.correct_answer}"</p>
                    </div>
                  )}
                </div>

                {/* AI Insights Section */}
                <div className="space-y-4">
                  <div className="flex gap-4 p-2">
                    <div className="mt-1 bg-indigo-50 p-2 rounded-lg"><MessageSquare size={16} className="text-indigo-500" /></div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">AI Interpretation</h4>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{q.ai_interpretation}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/50 shadow-inner">
                    <div className="mt-1 bg-amber-100 p-2 rounded-lg"><Lightbulb size={16} className="text-amber-600" /></div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">What this tells us</h4>
                      <p className="text-sm text-indigo-800/90 italic font-bold">"{q.what_it_tells_us}"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionAnalysis;
