export type MicCheckResult = {
  status: 'granted' | 'denied' | 'no_device' | 'error';
  deviceLabel?: string;
  errorMessage?: string;
};

export type RecordingResult = {
  audioBlob: Blob;
  durationSec: number;
  timestamp: number;
  mimeType: string;
};

export type RecordingState = 'idle' | 'recording' | 'paused' | 'error';

export class AudioRecordingService {
  private static instance: AudioRecordingService;
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  
  private startTime = 0;
  private chunks: Blob[] = [];
  
  private state: RecordingState = 'idle';
  private silenceTimer: number | NodeJS.Timeout | null = null;
  private silenceCallback: (() => void) | null = null;
  
  // 5 seconds of silence (approximate via frames) triggers the warning callback
  private SILENCE_FRAMES_THRESHOLD = 50; 
  private silenceFramesCount = 0;
  private IS_SILENT_RMS = 0.01;

  private visualizerInterval: any = null;
  private onVolumeChange: ((volume: number) => void) | null = null;

  private constructor() {}

  public static getInstance(): AudioRecordingService {
    if (!AudioRecordingService.instance) {
      AudioRecordingService.instance = new AudioRecordingService();
    }
    return AudioRecordingService.instance;
  }

  /**
   * Universal check before beginning any speaking task.
   */
  public async checkMicrophoneAccess(): Promise<MicCheckResult> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { status: 'error', errorMessage: 'Your browser does not support audio recording.' };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioIn = devices.some(d => d.kind === 'audioinput');
      
      if (!hasAudioIn) {
        return { status: 'no_device' };
      }

      // Briefly request stream to trigger native permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      const label = track?.label;
      
      // Stop the stream immediately, we just needed the permission
      stream.getTracks().forEach(t => t.stop());

      return { status: 'granted', deviceLabel: label };
    } catch (err: any) {
      console.warn('[AudioRecordingService] Mic access denied:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return { status: 'denied', errorMessage: 'Microphone permission was denied.' };
      }
      return { status: 'error', errorMessage: err.message || 'Failed to access microphone' };
    }
  }

  public setVolumeCallback(cb: (vol: number) => void) {
    this.onVolumeChange = cb;
  }

  public setSilenceWarningCallback(cb: () => void) {
    this.silenceCallback = cb;
  }

  public getState() { return this.state; }
  
  public getElapsedSeconds() {
    if (this.state !== 'recording') return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  public async startRecording(): Promise<void> {
    if (this.state === 'recording') return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Browser compat for best mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'; 
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser choose default
        }
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: mimeType ? mimeType : undefined });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      // Set up AudioContext for live volume and silence detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.microphone.connect(this.analyser);

      this.startTime = Date.now();
      this.state = 'recording';
      this.silenceFramesCount = 0;

      // 100ms chunks to ensure data flows quickly
      this.mediaRecorder.start(100);

      this.startVisualizerLoop();

    } catch (err: any) {
      console.error('[AudioRecordingService] start failed:', err);
      this.state = 'error';
      throw err;
    }
  }

  public stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.state !== 'recording') {
        reject(new Error("No active recording"));
        return;
      }

      this.stopVisualizerLoop();

      this.mediaRecorder.onstop = () => {
        const type = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        const durationSec = (Date.now() - this.startTime) / 1000;
        
        this.cleanup();
        this.state = 'idle';

        resolve({
          audioBlob: blob,
          durationSec,
          timestamp: Date.now(),
          mimeType: type
        });
      };

      this.mediaRecorder.stop();
    });
  }

  public cancelRecording(): void {
    if (this.mediaRecorder && this.state === 'recording') {
      this.stopVisualizerLoop();
      // Overwrite onstop so we don't resolve a pending promise anywhere
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.cleanup();
    this.state = 'idle';
  }

  private startVisualizerLoop() {
    this.visualizerInterval = setInterval(() => {
      if (!this.analyser) return;
      
      const dataArray = new Float32Array(this.analyser.frequencyBinCount);
      this.analyser.getFloatTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Callback for UI waveform
      if (this.onVolumeChange) {
        // Boost visually for UI
        this.onVolumeChange(Math.min(1.0, rms * 5));
      }

      // Advisory silence detection rule (does NOT stop recording)
      if (rms < this.IS_SILENT_RMS) {
        this.silenceFramesCount++;
        if (this.silenceFramesCount === this.SILENCE_FRAMES_THRESHOLD) {
           if (this.silenceCallback) this.silenceCallback();
        }
      } else {
        this.silenceFramesCount = 0; // reset
      }

    }, 100);
  }

  private stopVisualizerLoop() {
    if (this.visualizerInterval) {
      clearInterval(this.visualizerInterval);
      this.visualizerInterval = null;
    }
  }

  private cleanup() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.microphone && this.analyser) {
        this.microphone.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(e => console.warn(e));
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
