import React, { useState, useRef, useEffect } from 'react';
import { SessionTask, TaskFeedbackPayload } from '../../../types/runtime';
import { Play, Pause, RotateCcw, FileText } from 'lucide-react';

interface ModuleProps {
  task: SessionTask;
  onSubmit: (response: any) => void;
  isEvaluating: boolean;
  feedback: TaskFeedbackPayload | null;
  retryCount: number;
}

export const ListeningModule: React.FC<ModuleProps> = ({ task, onSubmit, isEvaluating, feedback, retryCount }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioSrc = task.payload?.audioSrc;
  const transcript = task.payload?.transcript || 'Transcript not available for this audio.';

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const onTimeUpdate = () => setCurrentTime(audio.currentTime);
      const onLoadedMetadata = () => setDuration(audio.duration);
      const onEnded = () => setIsPlaying(false);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {}); // catch autoplay issues
    }
    setIsPlaying(!isPlaying);
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    setReplayCount(c => c + 1);
    setIsPlaying(true);
  };

  const handleSlowPlayback = () => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = audioRef.current.playbackRate === 0.75 ? 1 : 0.75;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2, '0')}`;
  const isDisabled = isEvaluating || (feedback !== null && feedback.canAdvance);

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden Audio Element */}
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" />}

      {/* Media Player */}
      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
               onClick={togglePlay}
               disabled={!audioSrc}
               className="w-14 h-14 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-[0_4px_20px_rgba(79,70,229,0.3)] disabled:opacity-50"
            >
               {isPlaying ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current ml-1"/>}
            </button>
            <div>
              <div className="text-sm font-bold text-indigo-900 mb-1">Speaker Audio</div>
              <div className="text-xs text-indigo-600">{formatTime(currentTime)} / {formatTime(duration || 0)}</div>
            </div>
          </div>

          <div className="flex gap-2">
            {task.supportSettings.allowSlowAudio && (
              <button onClick={handleSlowPlayback} className="px-3 py-1 bg-white border border-indigo-100 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition">
                {audioRef.current?.playbackRate === 0.75 ? '1x' : '0.75x'}
              </button>
            )}
            {task.supportSettings.allowReplay && (
               <button onClick={handleReplay} className="p-2 bg-white border border-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-100 relative transition">
                 <RotateCcw className="w-4 h-4" />
                 <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{replayCount}</span>
               </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

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
