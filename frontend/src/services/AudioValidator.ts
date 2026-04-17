export type ValidatorResult = {
  valid: boolean;
  reason?: 'too_short' | 'too_long' | 'empty_blob' | 'silent_audio' | 'decode_error';
  userMessage?: string;
  durationSec: number;
  avgAmplitude: number;
};

export class AudioValidator {
  private static MIN_DURATION_SEC = 2.0;
  private static MAX_DURATION_SEC = 120.0;
  private static SILENCE_THRESHOLD = 0.005; // 0.5% amplitude

  /**
   * Validates an audio blob before submission.
   * Ensures non-zero length and checks for silence using an AudioContext.
   */
  public static async validate(blob: Blob, recordedDurationSec?: number): Promise<ValidatorResult> {
    if (!blob || blob.size === 0) {
      return {
        valid: false,
        reason: 'empty_blob',
        userMessage: 'Recording failed. No audio detected.',
        durationSec: 0,
        avgAmplitude: 0
      };
    }

    const duration = recordedDurationSec || 0;

    if (duration < this.MIN_DURATION_SEC) {
      return {
        valid: false,
        reason: 'too_short',
        userMessage: 'Please speak a little longer (at least 2 seconds).',
        durationSec: duration,
        avgAmplitude: 0
      };
    }

    if (duration > this.MAX_DURATION_SEC) {
       // We accept it, but could warn or truncate in the future
       console.warn(`[AudioValidator] Audio is quite long: ${duration}s`);
    }

    // Try to decode and check amplitude
    try {
      const buffer = await blob.arrayBuffer();
      // Browsers restrict AudioContext without user gesture, but typically 
      // we are within a user gesture (they clicked Stop).
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      
      const audioBuffer = await ctx.decodeAudioData(buffer);
      const channelData = audioBuffer.getChannelData(0);
      
      let sumSquares = 0;
      // Sample every 10th frame to save CPU
      for (let i = 0; i < channelData.length; i += 10) {
        sumSquares += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sumSquares / (channelData.length / 10));

      if (rms < this.SILENCE_THRESHOLD) {
        return {
          valid: false,
          reason: 'silent_audio',
          userMessage: 'We couldn\'t hear you. Please check your microphone and try again.',
          durationSec: duration,
          avgAmplitude: rms
        };
      }

      return {
        valid: true,
        durationSec: audioBuffer.duration || duration,
        avgAmplitude: rms
      };
      
    } catch (e: any) {
      console.warn('[AudioValidator] Failed to decode audio data. Falling back to duration check.', e);
      // If we can't decode (e.g., unsupported format in some browser), we fall back 
      // to assuming it's valid if length > min
      return {
        valid: true,
        durationSec: duration,
        avgAmplitude: 0,
        reason: 'decode_error' // Warning flag, but still valid
      };
    }
  }
}
