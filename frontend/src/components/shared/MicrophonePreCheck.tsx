import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, StopCircle, RefreshCcw, Volume2, CheckCircle2, Play } from 'lucide-react';
import { AudioRecordingService } from '../../services/AudioRecordingService';

interface PreCheckProps {
  onPassed: () => void;
  onCancel: () => void;
}

type Mode = 'idle' | 'requesting' | 'recording' | 'playback' | 'confirmed' | 'error';

export const MicrophonePreCheck: React.FC<PreCheckProps> = ({ onPassed, onCancel }) => {
  const [mode, setMode] = useState<Mode>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [volume, setVolume] = useState(0);
  const audioBlobRef = useRef<Blob | null>(null);
  
  useEffect(() => {
    return () => {
      // Clean up cleanly if unmounted midway
      if (mode === 'recording') {
        AudioRecordingService.getInstance().cancelRecording();
      }
    };
  }, [mode]);

  const handleStartTest = async () => {
    setMode('requesting');
    setErrorMsg('');
    
    const svc = AudioRecordingService.getInstance();
    const result = await svc.checkMicrophoneAccess();
    
    if (result.status !== 'granted') {
      setMode('error');
      setErrorMsg(result.errorMessage || 'Microphone not detected.');
      return;
    }

    setMode('recording');
    svc.setVolumeCallback(v => setVolume(v));
    
    try {
      await svc.startRecording();
      // Auto-record 3 seconds
      setTimeout(async () => {
        if (svc.getState() === 'recording') {
           const res = await svc.stopRecording();
           audioBlobRef.current = res.audioBlob;
           setMode('playback');
        }
      }, 3000);
    } catch (e: any) {
      setMode('error');
      setErrorMsg('Failed to start recording hardware.');
    }
  };

  const handlePlayBack = () => {
    if (!audioBlobRef.current) return;
    const url = URL.createObjectURL(audioBlobRef.current);
    const audio = new Audio(url);
    audio.play();
  };

  const handleConfirm = () => {
    setMode('confirmed');
    setTimeout(onPassed, 600);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-slate-200 dark:border-gray-800 rounded-3xl bg-white dark:bg-gray-900 w-full transition-colors duration-300">
      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
        <Mic className="w-8 h-8 text-indigo-500" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">Microphone Check</h3>
      
      {mode === 'idle' && (
        <>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-6 max-w-sm">We need to check your microphone before you can complete speaking tasks.</p>
          <div className="flex gap-3">
             <button onClick={onCancel} className="px-6 py-3 font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-gray-900-hover rounded-xl transition-colors">Skip for now</button>
             <button onClick={handleStartTest} className="px-6 py-3 bg-blue-600 dark:bg-blue-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">Test Microphone</button>
          </div>
        </>
      )}

      {mode === 'requesting' && (
        <div className="flex flex-col items-center gap-3">
           <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
           <p className="text-blue-600 dark:text-blue-400 font-bold">Please allow microphone access...</p>
        </div>
      )}

      {mode === 'recording' && (
        <div className="flex flex-col items-center gap-4">
           <p className="text-red-500 font-bold animate-pulse">Say something! Testing...</p>
           {/* Visualizer bar */}
           <div className="w-full max-w-[200px] h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden transition-colors duration-300">
              <div 
                className="h-full bg-emerald-500 transition-all duration-75" 
                style={{ width: `${Math.max(5, volume * 100)}%` }} 
              />
           </div>
        </div>
      )}

      {mode === 'playback' && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm text-center">
           <p className="text-slate-900 dark:text-slate-50 font-bold">Recording finished.</p>
           <button onClick={handlePlayBack} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/30 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl transition-colors">
              <Play className="w-5 h-5 fill-current" /> Play Back Test
           </button>
           <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Could you hear yourself clearly?</p>
           <div className="flex w-full gap-3">
              <button onClick={handleStartTest} className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-gray-900-hover font-bold rounded-xl border border-slate-200 dark:border-gray-800 transition-colors">No, try again</button>
              <button onClick={handleConfirm} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors">Yes, sounds good</button>
           </div>
        </div>
      )}

      {mode === 'confirmed' && (
        <div className="flex flex-col items-center gap-3">
           <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
             <CheckCircle2 className="w-6 h-6 text-emerald-500" />
           </div>
           <p className="text-emerald-700 font-bold">Microphone ready!</p>
        </div>
      )}

      {mode === 'error' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm text-center">
           <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 font-medium mb-2 w-full">
             {errorMsg}
           </div>
           <div className="flex w-full gap-3">
              <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold rounded-xl transition-colors">Skip task</button>
              <button onClick={handleStartTest} className="flex-1 py-3 bg-blue-600 dark:bg-blue-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                 <RefreshCcw className="w-4 h-4" /> Try Again
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
