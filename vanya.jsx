import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  Globe, 
  Mic, 
  MicOff, 
  Volume2, 
  Quote, 
  AlertCircle, 
  Square,
  Ghost
} from 'lucide-react';

const VanyaApp = () => {
  // --- State Management ---
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [error, setError] = useState(null);
  const [showNoSpeechModal, setShowNoSpeechModal] = useState(false);

  // --- Refs ---
  const recognitionRef = useRef(null);
  const chatContainerRef = useRef(null);
  const langRef = useRef('en'); // Fix for stale closures in event listeners
  const apiKey = "AIzaSyCrwz16nGReMEXO2Sah1RJGAX3MsLCEn-w"; // REPLACE WITH YOUR GEMINI API KEY

  // --- Constants & Config ---
  const texts = {
    en: {
      label: "Hindi", // Button shows what you can switch TO
      langCode: "hi-IN",
      welcome: '"Speak your heart, and the ancient wisdom shall guide you."',
      error: "Unable to connect to the divine source.",
      quotaError: "API quota exceeded. Please try again later."
    },
    hi: {
      label: "English",
      langCode: "en-US",
      welcome: '"अपने दिल की बात कहें, प्राचीन ज्ञान आपका मार्गदर्शन करेगा।"',
      error: "संपर्क करने में असमर्थ।",
      quotaError: "एपीआई कोटा पार हो गया है। कृपया बाद में पुन: प्रयास करें।"
    }
  };

  // --- Effects ---

  // 1. Sync Ref with State
  useEffect(() => {
    langRef.current = currentLang;
  }, [currentLang]);

  // 2. Initialize Speech Recognition on Mount
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Small delay to ensure state creates smooth transition
        setTimeout(() => {
          setIsProcessing(prev => prev ? prev : false); // Only stay processing if actually processing
        }, 500);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          handleVoiceInput(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showToast("Microphone access denied.");
        } else {
          showToast("Listening failed. Try again.");
        }
      };

      recognitionRef.current = recognition;
    } else {
      setShowNoSpeechModal(true);
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  // 3. Update Language in Recognition Instance
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
    }
  }, [currentLang]);

  // 4. Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isProcessing]);


  // --- Logic Functions ---

  const showToast = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const toggleLanguage = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setCurrentLang(prev => prev === 'en' ? 'hi' : 'en');
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setShowNoSpeechModal(true);
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const speakResponse = (shloka, meaning, guidance, lang) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      
      const fullText = `${shloka}. ${meaning}. ${guidance}`;
      const utterance = new SpeechSynthesisUtterance(fullText);
      
      // Use the language of the response, not necessarily the current state (though they should match)
      const targetLang = lang === 'hi' ? 'hi-IN' : 'en-US';
      utterance.lang = targetLang;
      utterance.rate = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const voiceSearchTerm = lang === 'hi' ? 'hi' : 'en';

      // Advanced Voice Selection Strategy
      let preferredVoice = voices.find(v => 
        v.lang.includes(voiceSearchTerm) && 
        (v.name.includes('Google') || v.name.includes('Swara') || v.name.includes('Female'))
      );

      // Fallback
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.lang.includes(voiceSearchTerm));
      }

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceInput = async (text) => {
    setIsProcessing(true);
    setMessages(prev => [...prev, { type: 'user', text }]);
    
    // Capture current language at start of request
    const requestLang = langRef.current; 

    const systemPrompt = `
      You are Vanya, a dedicated spiritual guide. Your sole purpose is to provide wisdom from Hindu Mythology, specifically the **Ramayana** and the **Bhagavad Gita**, regarding life problems, emotional struggles, and spiritual growth.
      
      CRITICAL INSTRUCTION:
      If the user asks about anything UNRELATED to spirituality, mental health, or life guidance (e.g., coding, math, general knowledge, news), you MUST politely refuse. Say: "I am Vanya, here only to guide your soul. Please ask me about your heart's burdens."

      If the query is relevant:
      1. Analyze the user's situation.
      2. Select a relevant **Sanskrit Shloka** (from Gita/Puranas) OR a **Chaupai** (from Ramcharitmanas).
      3. Provide its meaning.
      4. Give compassionate, practical advice based on the teachings of Lord Rama (Dharma/Duty) or Lord Krishna (Karma/Wisdom).

      Return JSON ONLY:
      {
        "shloka": "Sanskrit Shloka or Chaupai text",
        "meaning": "Meaning in ${requestLang === 'hi' ? 'Hindi' : 'English'}",
        "guidance": "Advice in ${requestLang === 'hi' ? 'Hindi' : 'English'}."
      }
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `User Said: "${text}"` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error('API Error');

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) throw new Error('No content generated');

      const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanText);

      setMessages(prev => [...prev, { type: 'bot', data: result }]);
      speakResponse(result.shloka, result.meaning, result.guidance, requestLang);

    } catch (err) {
      console.error(err);
      showToast(texts[requestLang].error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Render Helpers ---

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0B0F19] text-gray-200 font-sans selection:bg-[#F59E0B]/30 selection:text-[#FCD34D]">
      {/* Styles Injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,500&display=swap');
        
        .font-serif { fontFamily: 'Cormorant Garamond', serif; }
        .font-sans { fontFamily: 'Outfit', sans-serif; }
        
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background-color: #374151; border-radius: 20px; }

        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; opacity: 0; transform: translateY(15px); }
        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }

        .animate-typing { animation: typing 1.4s infinite ease-in-out both; }
        .animate-ripple { animation: ripple 1.5s linear infinite; }
        @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        @keyframes ripple { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.3); } 100% { box-shadow: 0 0 0 20px rgba(245, 158, 11, 0); } }
      `}</style>

      {/* Header */}
      <header className="flex-none bg-[#0B0F19]/80 backdrop-blur-md border-b border-[#1F2937] z-20 transition-all duration-500">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#111827] flex items-center justify-center border border-[#1F2937] shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-[#F59E0B]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Sparkles className="w-4 h-4 text-[#FCD34D] relative z-10" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-[#F3F4F6] tracking-wide">Vanya</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#9CA3AF] font-medium">Voice of Wisdom</p>
            </div>
          </div>

          <button 
            onClick={toggleLanguage}
            className="group flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1F2937] bg-[#111827] text-[#9CA3AF] hover:text-[#FCD34D] hover:border-[#F59E0B]/30 hover:bg-[#1F2937]/50 transition-all duration-300"
          >
            <Globe className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-xs font-serif font-medium tracking-wide">{texts[currentLang].label}</span>
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main 
        ref={chatContainerRef}
        className="flex-grow overflow-y-auto chat-scroll p-4 scroll-smooth bg-gradient-to-b from-[#0B0F19] via-[#0B0F19] to-[#05070A]"
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-32">
          
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="flex justify-center mt-8 mb-4 animate-fade-in-up">
              <div className="text-center space-y-3 px-4">
                <div className="inline-block p-4 rounded-full bg-[#111827] border border-[#1F2937] shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] mb-2">
                  <span className="text-3xl text-[#F59E0B] font-serif">ॐ</span>
                </div>
                <p className="text-[#9CA3AF] font-serif text-xl italic tracking-wide">
                  {texts[currentLang].welcome}
                </p>
              </div>
            </div>
          )}

          {/* Message List */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up px-2`}>
              {msg.type === 'user' ? (
                <div className="bg-[#D97706] text-white rounded-2xl rounded-tr-sm px-6 py-4 max-w-[85%] shadow-lg text-lg leading-relaxed font-light border border-[#F59E0B]/50 break-words">
                  {msg.text}
                </div>
              ) : (
                <div className="bg-[#111827]/95 backdrop-blur-md border border-[#1F2937] rounded-2xl rounded-tl-sm px-8 py-6 max-w-[95%] sm:max-w-[85%] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] relative group hover:border-[#374151] transition-colors">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#0B0F19] border border-[#374151] flex items-center justify-center shadow-lg z-10">
                    <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                  </div>

                  <div className="text-center mb-6 pb-6 border-b border-[#1F2937]/50 relative">
                    <Quote className="absolute top-0 left-0 text-[#1F2937]/30 w-8 h-8 -z-10 fill-current" />
                    <p className="font-serif text-2xl text-[#F3F4F6] font-medium mb-3 leading-relaxed tracking-wide">
                      "{msg.data.shloka}"
                    </p>
                    <p className="text-[#9CA3AF] font-serif italic text-base opacity-90">
                      {msg.data.meaning}
                    </p>
                  </div>

                  <div className="prose prose-invert max-w-none">
                    <p className="text-[#E5E7EB] leading-8 text-lg font-light">
                      {msg.data.guidance}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="bg-[#111827] border border-[#1F2937] rounded-2xl rounded-tl-none px-5 py-4 shadow-none inline-flex items-center gap-2">
                <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-typing" style={{ animationDelay: '-0.32s' }} />
                <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-typing" style={{ animationDelay: '-0.16s' }} />
                <div className="w-2 h-2 bg-[#F59E0B] rounded-full animate-typing" />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#05070A]/85 backdrop-blur-xl border-t border-[#111827]/50 py-4 px-4 z-30 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)]">
        <div className="max-w-3xl mx-auto flex items-center justify-center">
          <div className="relative">
            {isListening && (
              <div className="absolute inset-0 rounded-full bg-[#F59E0B]/20 animate-ripple blur-md" />
            )}
            
            <button
              onClick={handleMicClick}
              className={`
                w-16 h-16 rounded-full border shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center text-xl
                transition-all duration-300 hover:scale-105 active:scale-95 relative z-10 overflow-hidden
                ${isListening 
                  ? 'bg-[#F59E0B] text-white border-[#F59E0B] scale-110 animate-ripple' 
                  : isSpeaking
                    ? 'bg-[#111827] border-[#F59E0B] text-[#FCD34D] animate-pulse'
                    : 'bg-[#111827] border-[#374151] text-[#9CA3AF] hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                }
              `}
            >
              {isSpeaking ? (
                <Volume2 className="w-6 h-6" />
              ) : isListening ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Error Toast */}
      <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 transition-all duration-500 z-50 pointer-events-none w-11/12 max-w-sm ${error ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}>
        <div className="bg-red-900/90 backdrop-blur border border-red-800 text-red-200 px-6 py-3 rounded-full shadow-lg flex items-center gap-3 justify-center">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium text-xs">{error}</span>
        </div>
      </div>

      {/* No Speech Support Modal */}
      {showNoSpeechModal && (
        <div className="fixed inset-0 bg-[#05070A]/90 z-50 flex items-center justify-center p-6">
          <div className="bg-[#111827] border border-[#1F2937] p-6 rounded-2xl text-center max-w-sm shadow-2xl relative">
            <button onClick={() => setShowNoSpeechModal(false)} className="absolute top-4 right-4 text-[#9CA3AF] hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <MicOff className="w-10 h-10 text-[#6B7280] mx-auto mb-4" />
            <h3 className="text-xl font-serif text-[#FCD34D] mb-2">Voice Not Supported</h3>
            <p className="text-[#9CA3AF] text-sm mb-6">Your browser doesn't support the speech features required for this experience. Please try Chrome, Edge, or Safari.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VanyaApp;