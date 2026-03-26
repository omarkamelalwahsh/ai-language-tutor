import React, { useState } from 'react';
import { SessionTask, TaskFeedbackPayload } from '../../../types/runtime';
import { Mic, Loader2, StopCircle, Keyboard } from 'lucide-react';

interface ModuleProps {
  task: SessionTask;
  onSubmit: (response: any) => void;
  isEvaluating: boolean;
  feedback: TaskFeedbackPayload | null;
  retryCount: number;
}

export const SpeakingModule: React.FC<ModuleProps> = ({ task, onSubmit, isEvaluating, feedback, retryCount }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [textInput, setTextInput] = useState('');

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      onSubmit({ answer: "[Simulated Voice Output]", inputMode: 'voice' });
    } else {
      setIsRecording(true);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim().length > 0) {
      onSubmit({ answer: textInput, inputMode: 'text-fallback' });
    }
  };

  const isDisabled = isEvaluating || (feedback !== null && feedback.canAdvance);

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Voice Mode */}
      {!useTextFallback && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-white w-full h-64 relative">
          <div className="text-center mb-6">
            <p className="text-slate-500 font-medium mb-1">Speak your answer clearly</p>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Target length: 2-3 sentences</p>
          </div>

          <button
            onClick={handleRecordToggle}
            disabled={isDisabled}
            className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ${
              isRecording 
                ? 'bg-red-50 border-4 border-red-200 text-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.3)]' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_15px_30px_rgba(79,70,229,0.3)]'
            } disabled:opacity-50 disabled:scale-100 disabled:shadow-none`}
          >
            {isEvaluating ? <Loader2 className="w-10 h-10 animate-spin" /> : isRecording ? <StopCircle className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>

          {isRecording && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      )}

      {/* Text Fallback Mode */}
      {useTextFallback && (
        <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-100 text-amber-800 text-sm font-medium flex items-center gap-2">
            <Keyboard className="w-4 h-4" /> Text mode — type what you would say out loud
          </div>
          <div className="p-6">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your spoken response here..."
              className="w-full h-28 resize-none outline-none text-lg text-slate-800 placeholder:text-slate-300 bg-transparent"
              disabled={isDisabled}
            />
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400">{textInput.length} characters</span>
            <button
              onClick={handleTextSubmit}
              disabled={textInput.trim().length === 0 || isDisabled}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors"
            >
              {isEvaluating ? 'Checking...' : 'Submit Response'}
            </button>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <button
        onClick={() => { setUseTextFallback(!useTextFallback); setTextInput(''); }}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-2 transition-colors"
      >
        {useTextFallback ? <><Mic className="w-4 h-4" /> Switch to Voice</> : <><Keyboard className="w-4 h-4" /> Can't use microphone? Type instead</>}
      </button>
    </div>
  );
};
