export type TranscriptionResult = {
  text: string;
  confidence: number;
  language: string;
  duration: number;
};

export class SpeechToTextService {
  /**
   * Transcribe an audio blob using our `/api/transcribe` serverless function
   * which forwards to Groq Whisper.
   */
  public static async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      // The API key is managed securely on the backend in the serverless function.

      console.log(`[SpeechToTextService] Sending audio for transcription (${(audioBlob.size / 1024).toFixed(1)} KB)`);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        // Note: fetch will automatically set the correct Content-Type with the boundary for FormData
        body: formData, 
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Transcription failed with status: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      console.log(`[SpeechToTextService] Transcription success:`, data);

      return {
        text: data.text,
        confidence: data.confidence || 0.9, // Groq doesn't always provide confidence per segment
        language: data.language || 'en',
        duration: data.duration || 0,
      };

    } catch (error: any) {
      console.error('[SpeechToTextService] Transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }
}
