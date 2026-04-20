import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface AudioPlaybackControlProps {
  audioUrl?: string;
  transcript?: string;
  allowReplay?: boolean;
  allowSlowAudio?: boolean;
  onPlaybackComplete?: () => void;
  onReplay?: () => void;
  className?: string; // Additional classes for styling
}

export const AudioPlaybackControl: React.FC<AudioPlaybackControlProps> = ({
  audioUrl,
  transcript,
  allowReplay = true,
  allowSlowAudio = false,
  onPlaybackComplete,
  onReplay,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize TTS
  const useTTS = !audioUrl && !!transcript;
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (useTTS && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [useTTS]);

  // Handle native audio element
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      const audio = audioRef.current;
      const onTimeUpdate = () => setCurrentTime(audio.currentTime);
      const onLoadedMetadata = () => setDuration(audio.duration);
      const onEnded = () => {
        setIsPlaying(false);
        onPlaybackComplete?.();
      };
      
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      
      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, [audioUrl, onPlaybackComplete]);

  const togglePlay = () => {
    if (useTTS) {
      if (!synthRef.current) return;
      
      if (isPlaying) {
        synthRef.current.pause();
        setIsPlaying(false);
      } else {
        if (synthRef.current.paused) {
          synthRef.current.resume();
        } else {
          // Create new utterance if not paused (means it stopped or hasn't started)
          const utterance = new SpeechSynthesisUtterance(transcript);
          utterance.rate = playbackRate;
          utterance.onend = () => {
             setIsPlaying(false);
             onPlaybackComplete?.();
          };
          utteranceRef.current = utterance;
          synthRef.current.speak(utterance);
        }
        setIsPlaying(true);
      }
    } else {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleReplay = () => {
    if (useTTS) {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(transcript);
      utterance.rate = playbackRate;
      utterance.onend = () => {
         setIsPlaying(false);
         onPlaybackComplete?.();
      };
      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
      setReplayCount(c => c + 1);
      setIsPlaying(true);
      onReplay?.();
    } else {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setReplayCount(c => c + 1);
      setIsPlaying(true);
      onReplay?.();
    }
  };

  const handleSlowPlayback = () => {
    const newRate = playbackRate === 0.75 ? 1 : 0.75;
    setPlaybackRate(newRate);
    
    if (useTTS && utteranceRef.current && isPlaying) {
        // TTS doesn't allow changing rate mid-flight easily across browsers
        // best approach is to cancel and restart at the new rate, but that 
        // will restart from the beginning.
        synthRef.current?.cancel();
        const utterance = new SpeechSynthesisUtterance(transcript);
        utterance.rate = newRate;
        utterance.onend = () => {
           setIsPlaying(false);
           onPlaybackComplete?.();
        };
        utteranceRef.current = utterance;
        synthRef.current?.speak(utterance);
    } else if (!useTTS && audioRef.current) {
        audioRef.current.playbackRate = newRate;
    }
  };

  // Progress logic
  // For TTS, accurate progress tracking requires word boundary events, 
  // which can be flaky. We'll use a simpler fake "indeterminate" progress or just 0.
  const progress = useTTS ? (isPlaying ? 50 : 0) : (duration > 0 ? (currentTime / duration) * 100 : 0);
  
  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2, '0')}`;

  const isPlayReady = !!audioUrl || useTTS;

  return (
    <div className={`bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-6 rounded-3xl w-full transition-colors duration-300 ${className}`}>
      {/* Hidden Audio Element with Pre-loading enabled for Production-ready speed */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="auto" 
          autoPlay={false} 
          crossOrigin="anonymous" 
        />
      )}
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button 
             onClick={togglePlay}
             disabled={!isPlayReady}
             className="w-14 h-14 flex items-center justify-center bg-blue-600 dark:bg-blue-600 text-white rounded-full hover:bg-indigo-700 transition shadow-[0_4px_20px_rgba(79,70,229,0.3)] disabled:opacity-50"
             aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
             {isPlaying ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current ml-1"/>}
          </button>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-1">Speaker Audio</div>
            {useTTS ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Text-to-Speech Engine</div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">{formatTime(currentTime)} / {formatTime(duration || 0)}</div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {allowSlowAudio && (
            <button 
              onClick={handleSlowPlayback} 
              className="px-3 py-1 bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 text-indigo-500 text-xs font-bold rounded-lg hover:bg-white dark:bg-gray-900-hover transition-colors"
              aria-label="Toggle Slow Playback"
            >
              {playbackRate === 0.75 ? '1x' : '0.75x'}
            </button>
          )}
          {allowReplay && (
             <button 
               onClick={handleReplay} 
               disabled={!isPlayReady}
               className="p-2 bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 text-indigo-500 rounded-lg hover:bg-white dark:bg-gray-900-hover relative transition-colors disabled:opacity-50"
               aria-label="Replay Audio"
              >
               <RotateCcw className="w-4 h-4" />
               <span className="absolute -top-2 -right-2 bg-blue-600 dark:bg-blue-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{replayCount}</span>
             </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative transition-colors duration-300">
        <div 
          className={`h-full bg-indigo-500 transition-all ${useTTS && isPlaying ? 'animate-pulse w-full' : ''}`} 
          style={{ width: useTTS && isPlaying ? '100%' : `${progress}%` }} 
        />
      </div>
    </div>
  );
};
