import React, { useState } from 'react';
import { SessionTask, TaskFeedbackPayload } from '../../../types/runtime';
import { Eye, EyeOff } from 'lucide-react';

interface ModuleProps {
  task: SessionTask;
  onSubmit: (response: any) => void;
  isEvaluating: boolean;
  feedback: TaskFeedbackPayload | null;
  retryCount: number;
}

export const WritingModule: React.FC<ModuleProps> = ({ task, onSubmit, isEvaluating, feedback, retryCount }) => {
  const [text, setText] = useState('');
  const [showModel, setShowModel] = useState(false);

  const handleSubmit = () => {
    if (text.trim().length > 0) {
      onSubmit({ answer: text, revisionAttempt: retryCount });
    }
  };

  const isDisabled = isEvaluating || (feedback !== null && feedback.canAdvance);

  // Self-correction flow: determine the current stage
  const stage = retryCount === 0
    ? 'first-draft'
    : retryCount === 1
      ? 'self-correction'
      : 'guided-revision';

  const stageLabel = {
    'first-draft': 'Submit First Draft',
    'self-correction': 'Submit Self-Correction',
    'guided-revision': 'Submit Final Revision',
  }[stage];

  const stageHint = {
    'first-draft': null,
    'self-correction': 'Review your first attempt. Can you spot and fix any issues?',
    'guided-revision': feedback?.suggestedRetryConstraint || 'Focus on the specific feedback above.',
  }[stage];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-3xl border border-slate-200 dark:border-gray-800 shadow-sm overflow-hidden transition-colors duration-300">
      {/* Stage Indicator */}
      {stageHint && (
        <div className={`px-6 py-3 text-sm font-medium border-b flex items-center gap-2 ${
          stage === 'self-correction'
            ? 'bg-blue-50 border-blue-100 text-blue-800'
            : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          {stage === 'self-correction' ? '✏️' : '📝'} {stageHint}
        </div>
      )}

      <div className="flex-1 p-6 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={stage === 'first-draft' ? "Start writing your response here..." : "Revise your response..."}
          className="w-full h-full resize-none outline-none text-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-900 dark:text-slate-50/20 bg-transparent transition-colors duration-300"
          disabled={isDisabled}
        />
        
        {/* Model Answer Reveal (only after 2+ attempts or if provided) */}
        {feedback && feedback.modelAnswer && (
          <div className="absolute top-6 right-6 bottom-6">
            <button
              onClick={() => setShowModel(!showModel)}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-indigo-800 mb-2"
            >
              {showModel ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showModel ? 'Hide' : 'Show'} Model Answer
            </button>
            {showModel && (
              <div className="w-64 border-l pl-4 border-slate-200 dark:border-gray-800 transition-colors duration-300">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Model Approach</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm italic leading-relaxed">{feedback.modelAnswer}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            {text.length} characters
          </span>
          {retryCount > 0 && (
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
              Revision {retryCount}
            </span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={text.trim().length === 0 || isDisabled}
          className="px-6 py-2.5 bg-blue-600 dark:bg-blue-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors"
        >
          {isEvaluating ? 'Checking...' : stageLabel}
        </button>
      </div>
    </div>
  );
};
