import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, MessageSquare, Loader2, Send } from 'lucide-react';
import { useWebSpeech } from '../../hooks/useWebSpeech';
import { TutorBubble } from './TutorBubble';
import { supabase } from '../../lib/supabaseClient';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'tutor';
}

export const VirtualTutorWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: "Hi there! I'm your Personal AI Tutor. What would you like to practice today?", sender: 'tutor' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    
    const { isListening, isSpeaking, transcript, startListening, stopListening, speak, stopSpeaking } = useWebSpeech();
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, transcript]);

    // Handle end of speech recognition
    useEffect(() => {
        if (!isListening && transcript) {
            handleSend(transcript);
        }
    }, [isListening]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;
        
        const userMsg: Message = { id: Date.now().toString(), text, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const baseUrl = (import.meta as any).env.VITE_API_URL || '';
            const res = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                },
                body: JSON.stringify({ message: text })
            });

            if (res.ok) {
                const data = await res.json();
                const tutorMsg: Message = { id: (Date.now() + 1).toString(), text: data.reply, sender: 'tutor' };
                setMessages(prev => [...prev, tutorMsg]);
                // Automatically speak the response
                speak(data.reply);
            } else {
                setMessages(prev => [...prev, { id: Date.now().toString(), text: "I'm having trouble connecting right now. Let's try again.", sender: 'tutor' }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: Date.now().toString(), text: "Network error. Please try again.", sender: 'tutor' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const toggleMic = () => {
        if (isListening) {
            stopListening();
        } else {
            stopSpeaking();
            startListening();
        }
    };

    return (
        <>
            {/* The Floating Toggle Button */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center justify-center z-50 border border-cyan-400/30 transition-all ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'} neon-glow-primary`}
            >
                <Mic size={24} className="text-white" />
            </motion.button>

            {/* The Main Widget UI */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Background Blur Overlay when mic is active or generally to focus */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isListening ? 1 : 0 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-[#0a0f14]/70 backdrop-blur-sm z-40 pointer-events-none transition-all duration-500"
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-8 right-8 w-[400px] h-[600px] max-h-[80vh] bg-[#0a0f14]/85 backdrop-blur-2xl border border-cyan-500/20 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                                            <MessageSquare size={20} className="text-cyan-400" />
                                        </div>
                                        {isSpeaking && (
                                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-white tracking-tight">AI Tutor</h3>
                                        <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{isSpeaking ? 'Speaking...' : 'Online'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        setIsOpen(false);
                                        stopListening();
                                        stopSpeaking();
                                    }} 
                                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Chat Area */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide custom-scrollbar">
                                {messages.map((msg, idx) => (
                                    <TutorBubble key={msg.id} text={msg.text} sender={msg.sender} isLatest={idx === messages.length - 1} />
                                ))}
                                
                                {isTyping && (
                                    <div className="flex justify-start mb-4">
                                        <div className="bg-slate-900/60 p-4 rounded-[20px] rounded-tl-sm border border-indigo-500/20">
                                            <Loader2 size={16} className="text-indigo-400 animate-spin" />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Interim Transcript Bubble */}
                                {isListening && transcript && (
                                    <div className="flex justify-end mb-4 opacity-70">
                                        <div className="bg-emerald-600/30 p-4 rounded-[20px] rounded-tr-sm border border-emerald-500/20 text-white text-sm italic">
                                            {transcript}...
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Waveform Visualizer (CSS Simulated) */}
                            <div className="h-12 w-full flex items-center justify-center gap-1 px-8 opacity-60">
                                {Array.from({ length: 20 }).map((_, i) => (
                                     <motion.div
                                         key={i}
                                         animate={{
                                             height: (isListening || isSpeaking) 
                                                 ? [10, Math.random() * 30 + 10, 10] 
                                                 : 4,
                                             backgroundColor: isListening ? '#10b981' : isSpeaking ? '#22d3ee' : '#475569'
                                         }}
                                         transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                                         className="w-1 rounded-full shadow-[0_0_10px_currentColor]"
                                     />
                                 ))}
                            </div>

                            {/* Input Area */}
                            <div className="p-6 pt-2 relative">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSend(inputText);
                                        }}
                                        placeholder="Type or speak..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                                    />
                                    
                                    {inputText.trim() ? (
                                        <button 
                                            onClick={() => handleSend(inputText)}
                                            className="w-12 h-12 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 flex items-center justify-center transition-colors"
                                        >
                                            <Send size={18} className="text-cyan-400" />
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={toggleMic}
                                            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] border-transparent' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
                                        >
                                            {isListening && (
                                                <span className="absolute inset-0 rounded-2xl border-2 border-emerald-400 animate-ping opacity-50" />
                                            )}
                                            <Mic size={18} className={isListening ? 'text-white' : 'text-slate-400'} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
