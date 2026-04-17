import React, { useState } from 'react';
import { SessionTask, TaskFeedbackPayload } from '../../../types/runtime';
import { Keyboard } from 'lucide-react';

interface ModuleProps {
  task: SessionTask;
  onSubmit: (response: any) => void;
  isEvaluating: boolean;
  feedback: TaskFeedbackPayload | null;
  retryCount: number;
}

export const VocabularyModule: React.FC<ModuleProps> = ({ task, onSubmit, isEvaluating, feedback, retryCount }) => {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [useProductionMode, setUseProductionMode] = useState(false);

  const targetWord = task.payload?.targetWord;
  const distractors = task.payload?.distractors || [];
  
  // Mixed options (naive shuffle for demo)
  const options = [targetWord, ...distractors].sort();

  const isDisabled = isEvaluating || (feedback !== null && feedback.canAdvance);

  const handleSubmit = () => {
    const answer = useProductionMode ? typedAnswer : selectedAnswer;
    if (answer.trim().length > 0) {
      onSubmit({
        answer,
        recognizedWord: answer,
        inputMode: useProductionMode ? 'production' : 'recognition',
        retryAttempt: retryCount,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 items-center">
      {/* Recognition Mode (Multiple Choice) */}
      {!useProductionMode && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full max-w-2xl text-center">
           <h3 className="text-xl font-medium text-slate-600 leading-relaxed mb-8">
              {task.prompt.split('____').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="inline-block border-b-2 border-slate-400 w-32 mx-2 text-indigo-700 font-bold px-4">
                       {selectedAnswer}
                    </span>
                  )}
                </React.Fragment>
              ))}
           </h3>

           <div className="flex flex-wrap justify-center gap-3">
              {options.map((opt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedAnswer(opt)}
                  disabled={isDisabled}
                  className={`px-5 py-3 rounded-xl border-2 font-bold transition-all ${
                    selectedAnswer === opt 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
           </div>
        </div>
      )}

      {/* Production Mode (Type Answer) */}
      {useProductionMode && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full max-w-2xl">
          <div className="text-center mb-6">
            <h3 className="text-xl font-medium text-slate-600 leading-relaxed">
              {task.prompt.split('____').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="inline-block border-b-2 border-indigo-400 w-40 mx-2 text-indigo-700 font-bold px-4">
                       {typedAnswer || '...'}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </h3>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Type the correct word or phrase..."
              disabled={isDisabled}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <button
        onClick={() => { setUseProductionMode(!useProductionMode); setSelectedAnswer(''); setTypedAnswer(''); }}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-2 transition-colors"
      >
        <Keyboard className="w-4 h-4" /> {useProductionMode ? 'Switch to Multiple Choice' : 'Want to type? Use Production Mode'}
      </button>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={(useProductionMode ? typedAnswer.trim().length === 0 : selectedAnswer === '') || isDisabled}
        className="w-full max-w-2xl py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-sm"
      >
        Check Contextual Fit
      </button>
    </div>
  );
};
