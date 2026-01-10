// The Partner - Conversational Voice Interface Module

const PartnerModule = {
    conversationHistory: [],
    currentImage: null,
    currentImageMime: null,
    isProcessing: false,
    
    // Initialize module
    init() {
        this.setupEventListeners();
        this.setupVoiceHandlers();
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Text input
        const textInput = $('#text-input');
        const sendBtn = $('#send-btn');
        
        if (textInput) {
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        // Mic button
        const micBtn = $('#mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', () => this.toggleVoice());
        }
        
        // Image attachment
        const attachBtn = $('#voice-attach-btn');
        const imageInput = $('#voice-image-input');
        const removeImageBtn = $('#remove-voice-image');
        
        if (attachBtn) {
            attachBtn.addEventListener('click', () => imageInput.click());
        }
        
        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.handleImageAttach(e));
        }
        
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => this.removeAttachedImage());
        }
        
        // Quick actions
        $$('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                if (query) {
                    $('#text-input').value = query;
                    this.sendMessage();
                }
            });
        });
    },
    
    // Setup voice handlers
    setupVoiceHandlers() {
        if (!VoiceAPI.isSupported()) {
            const micBtn = $('#mic-btn');
            if (micBtn) micBtn.style.display = 'none';
            return;
        }
        
        VoiceAPI.onListeningStart = () => {
            const micBtn = $('#mic-btn');
            const visualizer = $('#voice-visualizer');
            const status = $('#assistant-status');
            
            if (micBtn) micBtn.classList.add('listening');
            if (visualizer) visualizer.classList.remove('hidden');
            if (status) {
                status.textContent = 'Listening...';
                status.classList.add('listening');
            }
        };
        
        VoiceAPI.onListeningEnd = () => {
            const micBtn = $('#mic-btn');
            const visualizer = $('#voice-visualizer');
            const status = $('#assistant-status');
            
            if (micBtn) micBtn.classList.remove('listening');
            if (visualizer) visualizer.classList.add('hidden');
            if (status) {
                status.textContent = 'Ready to help';
                status.classList.remove('listening');
            }
        };
        
        VoiceAPI.onResult = (transcript) => {
            $('#text-input').value = transcript;
            this.sendMessage();
        };
        
        VoiceAPI.onError = (error) => {
            if (error !== 'no-speech') {
                Utils.toast.error('Voice recognition error. Please try again.');
            }
        };
    },
    
    // Toggle voice input
    toggleVoice() {
        if (this.isProcessing) return;
        VoiceAPI.toggleListening();
    },
    
    // Handle image attachment
    async handleImageAttach(e) {
        if (!e.target.files.length) return;
        
        const file = e.target.files[0];
        const validation = Utils.file.validateImage(file);
        
        if (!validation.valid) {
            Utils.toast.error(validation.error);
            return;
        }
        
        try {
            const dataUrl = await Utils.file.toDataURL(file);
            const base64 = await Utils.file.toBase64(file);
            
            this.currentImage = base64;
            this.currentImageMime = Utils.file.getMimeType(file);
            
            // Show preview
            const preview = $('#voice-image-preview');
            const previewImg = $('#voice-attached-image');
            
            if (preview) preview.classList.remove('hidden');
            if (previewImg) previewImg.src = dataUrl;
            
            Utils.toast.info('Image attached. Send a message to analyze it.');
        } catch (error) {
            Utils.toast.error('Failed to attach image');
        }
    },
    
    // Remove attached image
    removeAttachedImage() {
        this.currentImage = null;
        this.currentImageMime = null;
        
        const preview = $('#voice-image-preview');
        const input = $('#voice-image-input');
        
        if (preview) preview.classList.add('hidden');
        if (input) input.value = '';
    },
    
    // Send message
    async sendMessage() {
        const input = $('#text-input');
        const message = input.value.trim();
        
        if (!message && !this.currentImage) {
            Utils.toast.warning('Please enter a message or attach an image');
            return;
        }
        
        if (!GeminiAPI.isConfigured()) {
            Utils.toast.error('Please configure your Gemini API key in Settings');
            return;
        }
        
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        // Clear input
        input.value = '';
        
        // Add user message to UI
        this.addMessage('user', message, this.currentImage ? $('#voice-attached-image')?.src : null);
        
        // Update status
        const status = $('#assistant-status');
        if (status) {
            status.textContent = 'Thinking...';
            status.classList.add('processing');
        }
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await GeminiAPI.askAssistant(
                message || 'What can you tell me about this image?',
                this.currentImage,
                this.currentImageMime,
                this.conversationHistory.slice(-6) // Last 6 messages for context
            );
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add assistant response
            this.addMessage('assistant', response);
            
            // Store in history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: response }
            );
            
            // Speak response if enabled
            if (VoiceAPI.isEnabled) {
                // Clean response for speech (remove markdown, emojis, etc.)
                const speakText = response
                    .replace(/[#*_~`]/g, '')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    .substring(0, 500); // Limit length for speech
                
                VoiceAPI.speak(speakText);
            }
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('assistant', `Sorry, I encountered an error: ${error.message}. Please try again.`);
            Utils.toast.error('Failed to get response');
        } finally {
            this.isProcessing = false;
            
            // Reset status
            if (status) {
                status.textContent = 'Ready to help';
                status.classList.remove('processing');
            }
            
            // Clear attached image
            this.removeAttachedImage();
        }
    },
    
    // Add message to UI
    addMessage(role, content, imageUrl = null) {
        const container = $('#messages-container');
        if (!container) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        
        let contentHtml = this.formatMessage(content);
        
        if (imageUrl) {
            contentHtml = `<img src="${imageUrl}" alt="Attached image" class="message-image">${contentHtml}`;
        }
        
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageEl.innerHTML = `
            <div class="message-content">
                ${contentHtml}
            </div>
            <span class="message-time">${time}</span>
        `;
        
        container.appendChild(messageEl);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },
    
    // Format message content
    formatMessage(content) {
        if (!content) return '';
        
        // Convert markdown-style formatting
        let formatted = content
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            // Lists
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap lists
        formatted = formatted.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');
        
        // Wrap in paragraph if not already structured
        if (!formatted.startsWith('<')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        return formatted;
    },
    
    // Show typing indicator
    showTypingIndicator() {
        const container = $('#messages-container');
        if (!container) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'message assistant typing-message';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    },
    
    // Hide typing indicator
    hideTypingIndicator() {
        const indicator = $('.typing-message');
        if (indicator) indicator.remove();
    },
    
    // Clear conversation
    clearConversation() {
        this.conversationHistory = [];
        
        const container = $('#messages-container');
        if (container) {
            container.innerHTML = `
                <div class="message assistant">
                    <div class="message-content">
                        <p>Hello! I'm your AI agronomist. How can I help you today?</p>
                    </div>
                </div>
            `;
        }
    }
};

// Export
window.PartnerModule = PartnerModule;
