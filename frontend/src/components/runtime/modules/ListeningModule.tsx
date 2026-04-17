import React, { useState } from 'react';
import { SessionTask, TaskFeedbackPayload } from '../../../types/runtime';
import { FileText } from 'lucide-react';
import { AudioPlaybackControl } from '../../shared/AudioPlaybackControl';

interface ModuleProps {
  task: SessionTask;
  onSubmit: (response: any) => void;
  isEvaluating: boolean;
  feedback: TaskFeedbackPayload | null;
  retryCount: number;
}

export const ListeningModule: React.FC<ModuleProps> = ({ task, onSubmit, isEvaluating, feedback, retryCount }) => {
  const [replayCount, setReplayCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  const audioSrc = task.payload?.audioSrc;
  const transcript = task.payload?.transcript || 'Transcript not available for this audio.';
  const isDisabled = isEvaluating || (feedback !== null && feedback.canAdvance);

  return (
    <div className="flex flex-col gap-6">
      <AudioPlaybackControl
        audioUrl={audioSrc}
        transcript={transcript}
        allowReplay={task.supportSettings.allowReplay}
        allowSlowAudio={task.supportSettings.allowSlowAudio}
        onReplay={() => setReplayCount(c => c + 1)}
      />

      {/* Transcript Toggle */}
      {task.supportSettings.allowTranscript && (
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="self-start flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
        >
          <FileText className="w-4 h-4" /> {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
        </button>
      )}
      {showTranscript && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm text-slate-600 italic leading-relaxed">
          {transcript}
        </div>
      )}

      {/* Comprehension Input */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl">
        <h4 className="text-sm font-bold text-slate-800 mb-3">Your Answer</h4>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="What did you understand?"
          className="w-full h-24 resize-none outline-none text-slate-700 placeholder:text-slate-300"
          disabled={isDisabled}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => onSubmit({ answer, replayCount, transcriptUsed: showTranscript })}
            disabled={answer.trim().length === 0 || isDisabled}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors"
          >
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
};
