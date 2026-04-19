import React, { useState, useRef, useEffect } from 'react';
import { SessionTask, TaskFeedbackPayload } from '../../../types/runtime';
import { Mic, Loader2, StopCircle, Keyboard, Play, RefreshCcw, AlertTriangle, Send } from 'lucide-react';
import { AudioRecordingService } from '../../../services/AudioRecordingService';
import { AudioValidator, ValidatorResult } from '../../../services/AudioValidator';
import { SpeechToTextService } from '../../../services/SpeechToTextService';
import { MicrophonePreCheck } from '../../shared/MicrophonePreCheck';
import { SpeakingSubmissionMeta, ResponseMode } from '../../../types/assessment';

interface ModuleProps {
  task: SessionTask;
  onSubmit: (response: any) => void;
  isEvaluating: boolean;
  feedback: TaskFeedbackPayload | null;
  retryCount: number;
  userId?: string;
  assessmentId?: string;
}

type Mode = 'mic_check' | 'ready' | 'recording' | 'review' | 'submitted';

// Session-level flag to avoid re-testing mic for every speaking question
let sessionMicPassed = false;

export const SpeakingModule: React.FC<ModuleProps> = ({ task, onSubmit, isEvaluating, feedback, retryCount, userId, assessmentId }) => {
  const [mode, setMode] = useState<Mode>(sessionMicPassed ? 'ready' : 'mic_check');
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  const [volume, setVolume] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [validationResult, setValidationResult] = useState<ValidatorResult | null>(null);
  
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const isDisabled = isEvaluating || isTranscribing || isUploading || (feedback !== null && feedback.canAdvance);

  useEffect(() => {
    // Reset state when a new task is loaded
    setMode(sessionMicPassed ? 'ready' : 'mic_check');
    setUseTextFallback(false);
    setTextInput('');
    setVolume(0);
    setDurationSec(0);
    setErrorMsg('');
    setValidationResult(null);
    setAudioBlob(null);
    setIsUploading(false);
    setIsTranscribing(false);

    const svc = AudioRecordingService.getInstance();
    if (svc.getState() === 'recording') {
      svc.cancelRecording();
    }
    stopTimer();
  }, [task.id]);


  useEffect(() => {
    return () => {
      stopTimer();
      const svc = AudioRecordingService.getInstance();
      if (svc.getState() === 'recording') {
        svc.cancelRecording();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = () => {
    setDurationSec(0);
    timerRef.current = setInterval(() => {
       setDurationSec(AudioRecordingService.getInstance().getElapsedSeconds());
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // --- Voice Flow Handlers ---

  const handleStartRecording = async () => {
    setErrorMsg('');
    try {
      const svc = AudioRecordingService.getInstance();
      svc.setVolumeCallback(v => setVolume(v));
      await svc.startRecording();
      setMode('recording');
      startTimer();
    } catch (e: any) {
      setErrorMsg("Failed to start recording. Please check microphone permissions.");
    }
  };

  const handleStopRecording = async () => {
    stopTimer();
    try {
      const svc = AudioRecordingService.getInstance();
      const res = await svc.stopRecording();
      setAudioBlob(res.audioBlob);
      
      // Validate
      const validation = await AudioValidator.validate(res.audioBlob, res.durationSec);
      setValidationResult(validation);
      
      if (!validation.valid) {
        setErrorMsg(validation.userMessage || 'Recording invalid.');
      } else {
        setErrorMsg('');
      }
      
      setMode('review');
    } catch (e: any) {
      setErrorMsg("Failed to save recording.");
      setMode('ready');
    }
  };

  const handleRerecord = () => {
    setAudioBlob(null);
    setValidationResult(null);
    setErrorMsg('');
    setDurationSec(0);
    setMode('ready');
  };

  const handleVoiceSubmit = async () => {
    if (!audioBlob || !validationResult?.valid) return;
    
    setIsUploading(true);
    setErrorMsg('');

    try {
      const svc = AudioRecordingService.getInstance();
      
      // 1. Upload to Supabase Storage (Evidence Preservation)
      console.log("[SpeakingModule] ⬆️ Uploading evidence audio...");
      let audioUrl = null;
      try {
        audioUrl = await svc.uploadAudio(
          audioBlob, 
          userId || 'anonymous', 
          assessmentId || 'battery-session', 
          task.id
        );
      } catch (uploadErr) {
        console.warn("[SpeakingModule] Audio upload failed, proceeding with transcription:", uploadErr);
      } finally {
        setIsUploading(false);
      }

      setIsTranscribing(true);


      // 2. Transcribe
      console.log("[SpeakingModule] ✍️ Transcribing speech...");
      const transcribeRes = await SpeechToTextService.transcribe(audioBlob);
      
      const meta: SpeakingSubmissionMeta = {
        responseMode: 'voice',
        hasValidAudio: true,
        audioDurationSec: validationResult.durationSec,
        micCheckPassed: sessionMicPassed,
        transcriptionAvailable: true,
        audioUrl: audioUrl || undefined // Attached URL for DB record
      };

      onSubmit({
        answer: transcribeRes.text,
        inputMode: 'voice',
        speakingMeta: meta,
        responseMode: 'voice',
        audioUrl: audioUrl
      });
      
      setMode('submitted');
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to process your speech. Please try again or type your answer.");
      setIsUploading(false);
      setIsTranscribing(false);
    }
  };


  // --- Text Fallback Handlers ---

  const handleTextSubmit = () => {
    if (textInput.trim().length === 0) return;
    
    const meta: SpeakingSubmissionMeta = {
      responseMode: 'typed_fallback',
      hasValidAudio: false,
      micCheckPassed: sessionMicPassed
    };

    onSubmit({ 
      answer: textInput, 
      inputMode: 'typed_fallback',
      speakingMeta: meta,
      responseMode: 'typed_fallback'
    });
  };

  // --- Playback Audio Element ---
  useEffect(() => {
    if (audioBlob && mode === 'review') {
      const url = URL.createObjectURL(audioBlob);
      if (audioElementRef.current) {
        audioElementRef.current.src = url;
      }
      return () => URL.revokeObjectURL(url);
    }
  }, [audioBlob, mode]);


  // ============================================
  // RENDER BLOCKS
  // ============================================

  if (mode === 'mic_check' && !useTextFallback) {
    return (
      <div className="w-full">
        <MicrophonePreCheck 
          onPassed={() => {
            sessionMicPassed = true;
            setMode('ready');
          }}
          onCancel={() => setUseTextFallback(true)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 w-full max-w-2xl mx-auto">
      {/* Voice Mode */}
      {!useTextFallback && mode !== 'mic_check' && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-slate-200 rounded-3xl bg-white w-full h-[320px] relative shadow-sm">
          
          {(mode === 'ready' || mode === 'recording') && (
            <>
              <div className="text-center mb-6">
                <p className="text-slate-500 font-medium mb-1">Speak your answer clearly</p>
                <div className="h-6 mt-2">
                   {mode === 'recording' && (
                     <span className="font-mono text-lg font-bold text-slate-700">{formatTime(durationSec)}</span>
                   )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                {mode === 'ready' ? (
                  <button
                    onClick={handleStartRecording}
                    disabled={isDisabled}
                    className="relative flex flex-col items-center justify-center w-28 h-28 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_15px_30px_rgba(79,70,229,0.3)] transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 font-bold z-10"
                  >
                    <Mic className="w-8 h-8 mb-1" />
                    <span>Start</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="relative flex flex-col items-center justify-center w-28 h-28 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-[0_15px_30px_rgba(239,68,68,0.4)] transition-all transform active:scale-95 font-bold z-10"
                  >
                    <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
                    <StopCircle className="w-8 h-8 mb-1 relative z-20" />
                    <span className="relative z-20">Stop</span>
                  </button>
                )}
                
                {/* 🌈 Dynamic Visualizer: Production-grade feedback */}
                <div 
                   className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden mt-6 transition-all duration-500" 
                   style={{ opacity: mode === 'recording' ? 1 : 0, transform: mode === 'recording' ? 'scaleY(1.5)' : 'scaleY(1)' }}
                 >
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 transition-all duration-75 origin-left" 
                    style={{ width: `${Math.max(4, volume * 100)}%` }} 
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'review' && (
            <div className="flex flex-col items-center w-full gap-5">
              <audio ref={audioElementRef} controls className="w-full max-w-sm mb-2" />
              
              {validationResult && !validationResult.valid && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              
              <div className="flex w-full gap-4 max-w-sm">
                <button 
                  onClick={handleRerecord} 
                  disabled={isDisabled}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-5 h-5" /> Retake
                </button>
                
                <button 
                  onClick={handleVoiceSubmit} 
                  disabled={!validationResult?.valid || isDisabled}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-200 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
                  ) : isTranscribing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Transcribing...</>
                  ) : isEvaluating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                  ) : (
                    <><Send className="w-5 h-5" /> Submit</>
                  )}
                </button>

              </div>
            </div>
          )}

          {mode === 'submitted' && (
             <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
                  <Mic className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-xl font-bold text-slate-800">Recording Submitted</p>
                <p className="text-slate-500">Waiting for feedback...</p>
             </div>
          )}
          
          {errorMsg && mode !== 'review' && (
             <div className="absolute top-4 w-[90%] left-1/2 -translate-x-1/2 text-center p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                {errorMsg}
             </div>
          )}
        </div>
      )}

      {/* Text Fallback Mode */}
      {useTextFallback && (
        <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-100 text-amber-800 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Missing Spoken Evidence</span>
              Using text instead of your voice means we cannot evaluate your true speaking level. Your overall speaking placement will be heavily restricted.
            </div>
          </div>
          <div className="p-6">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type out exactly what you would say..."
              className="w-full h-32 resize-none outline-none text-lg text-slate-800 placeholder:text-slate-300 bg-transparent"
              disabled={isDisabled}
            />
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400">{textInput.length} characters</span>
            <button
              onClick={handleTextSubmit}
              disabled={textInput.trim().length === 0 || isDisabled}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Typing'}
            </button>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <button
        onClick={() => { setUseTextFallback(!useTextFallback); setErrorMsg(''); }}
        disabled={isTranscribing || isEvaluating}
        className="text-sm text-slate-500 hover:text-slate-800 font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
      >
        {useTextFallback ? (
           <><Mic className="w-4 h-4" /> Try using microphone instead</>
        ) : (
           <><Keyboard className="w-4 h-4" /> Can't use microphone? Type instead</>
        )}
      </button>
    </div>
  );
};
