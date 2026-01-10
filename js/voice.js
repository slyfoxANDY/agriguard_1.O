// Voice Interface for AgriGuard (The Partner)

const VoiceAPI = {
    recognition: null,
    synthesis: null,
    isListening: false,
    isEnabled: true,
    speechRate: 1,
    
    // Initialize voice API
    init() {
        // Load settings
        this.isEnabled = Utils.storage.get(CONFIG.STORAGE_KEYS.VOICE_ENABLED, true);
        this.speechRate = Utils.storage.get(CONFIG.STORAGE_KEYS.VOICE_SPEED, 1);
        
        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = CONFIG.VOICE_LANG;
            
            this.setupRecognitionHandlers();
        }
        
        // Initialize speech synthesis
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
        }
        
        return this.isSupported();
    },
    
    // Check if voice is supported
    isSupported() {
        return this.recognition !== null;
    },
    
    // Check if TTS is supported
    isTTSSupported() {
        return this.synthesis !== null;
    },
    
    // Setup recognition event handlers
    setupRecognitionHandlers() {
        if (!this.recognition) return;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.onListeningStart();
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.onListeningEnd();
        };
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscript) {
                this.onResult(finalTranscript);
            } else if (interimTranscript) {
                this.onInterimResult(interimTranscript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.onError(event.error);
        };
    },
    
    // Start listening
    startListening() {
        if (!this.recognition) {
            Utils.toast.error('Voice recognition not supported in this browser');
            return false;
        }
        
        if (this.isListening) {
            return false;
        }
        
        try {
            this.recognition.start();
            return true;
        } catch (e) {
            console.error('Start listening error:', e);
            return false;
        }
    },
    
    // Stop listening
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    },
    
    // Toggle listening
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
        return this.isListening;
    },
    
    // Speak text
    speak(text, options = {}) {
        if (!this.synthesis || !this.isEnabled) {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            // Cancel any ongoing speech
            this.synthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = options.lang || CONFIG.VOICE_LANG;
            utterance.rate = options.rate || this.speechRate;
            utterance.pitch = options.pitch || 1;
            utterance.volume = options.volume || 1;
            
            // Select a good voice
            const voices = this.synthesis.getVoices();
            const preferredVoice = voices.find(v => 
                v.lang.startsWith('en') && 
                (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha'))
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            utterance.onend = () => resolve();
            utterance.onerror = (e) => reject(e);
            
            this.synthesis.speak(utterance);
        });
    },
    
    // Stop speaking
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    },
    
    // Enable/disable voice
    setEnabled(enabled) {
        this.isEnabled = enabled;
        Utils.storage.set(CONFIG.STORAGE_KEYS.VOICE_ENABLED, enabled);
    },
    
    // Set speech rate
    setSpeechRate(rate) {
        this.speechRate = rate;
        Utils.storage.set(CONFIG.STORAGE_KEYS.VOICE_SPEED, rate);
    },
    
    // Get available voices
    getVoices() {
        if (!this.synthesis) return [];
        return this.synthesis.getVoices().filter(v => v.lang.startsWith('en'));
    },
    
    // Event callbacks (to be overridden)
    onListeningStart() {
        console.log('Started listening');
    },
    
    onListeningEnd() {
        console.log('Stopped listening');
    },
    
    onResult(transcript) {
        console.log('Final transcript:', transcript);
    },
    
    onInterimResult(transcript) {
        console.log('Interim:', transcript);
    },
    
    onError(error) {
        console.error('Voice error:', error);
    }
};

// Export
window.VoiceAPI = VoiceAPI;
