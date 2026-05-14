import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWebSpeechReturn {
    isListening: boolean;
    isSpeaking: boolean;
    transcript: string;
    startListening: () => void;
    stopListening: () => void;
    speak: (text: string, onEnd?: () => void) => void;
    stopSpeaking: () => void;
}

export const useWebSpeech = (): UseWebSpeechReturn => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    useEffect(() => {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let currentTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        } else {
            console.warn('Speech Recognition API not supported in this browser.');
        }

        // Initialize Speech Synthesis
        if ('speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
        } else {
            console.warn('Speech Synthesis API not supported in this browser.');
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (synthRef.current) synthRef.current.cancel();
        };
    }, []);

    const startListening = useCallback(() => {
        if (!recognitionRef.current) return;
        setTranscript('');
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error('Recognition start error', e);
        }
    }, []);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
        setIsListening(false);
    }, []);

    const speak = useCallback((text: string, onEnd?: () => void) => {
        if (!synthRef.current) return;
        synthRef.current.cancel(); // Stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        // You could adjust rate here, e.g. based on user CEFR level
        utterance.rate = 0.95; 
        utterance.pitch = 1.0;

        // Try to find a good English voice
        const voices = synthRef.current.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            if (onEnd) onEnd();
        };
        utterance.onerror = (e) => {
            console.error('Speech Synthesis Error', e);
            setIsSpeaking(false);
        };

        synthRef.current.speak(utterance);
    }, []);

    const stopSpeaking = useCallback(() => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        setIsSpeaking(false);
    }, []);

    return {
        isListening,
        isSpeaking,
        transcript,
        startListening,
        stopListening,
        speak,
        stopSpeaking
    };
};
