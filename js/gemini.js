// Gemini AI Integration for AgriGuard

const GeminiAPI = {
    apiKey: null,
    
    // Initialize with API key
    init() {
        this.apiKey = Utils.storage.get(CONFIG.STORAGE_KEYS.API_KEY);
        return this.apiKey !== null;
    },
    
    // Set API key
    setApiKey(key) {
        this.apiKey = key;
        Utils.storage.set(CONFIG.STORAGE_KEYS.API_KEY, key);
    },
    
    // Get API key
    getApiKey() {
        return this.apiKey;
    },
    
    // Check if API is configured
    isConfigured() {
        return this.apiKey && this.apiKey.length > 0;
    },
    
    // Make API request
    async request(model, contents, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('API key not configured. Please add your Gemini API key in Settings.');
        }
        
        const url = `${CONFIG.GEMINI_API_URL}/${model}:generateContent?key=${this.apiKey}`;
        
        const body = {
            contents,
            generationConfig: {
                temperature: options.temperature || 0.7,
                topK: options.topK || 40,
                topP: options.topP || 0.95,
                maxOutputTokens: options.maxTokens || 8192,
            }
        };
        
        if (options.systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: options.systemInstruction }]
            };
        }
        
        console.log('🌱 Gemini Request:', { model, contentLength: contents.length });
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ Gemini API Error Response:', data);
                throw new Error(data.error?.message || `API request failed: ${response.status}`);
            }
            
            console.log('✅ Gemini Response received');
            
            if (!data.candidates || data.candidates.length === 0) {
                console.error('❌ No candidates in response:', data);
                throw new Error('No response generated. The model may have blocked the content.');
            }
            
            // Check for blocked content
            if (data.candidates[0].finishReason === 'SAFETY') {
                console.warn('⚠️ Content was blocked by safety filters');
                throw new Error('Response was blocked by safety filters. Please try with a different image.');
            }
            
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    },
    
    // Text-only request
    async generateText(prompt, options = {}) {
        const contents = [
            {
                parts: [{ text: prompt }]
            }
        ];
        
        return this.request(CONFIG.GEMINI_MODEL, contents, options);
    },
    
    // Vision request (image + text)
    async analyzeImage(imageBase64, mimeType, prompt, options = {}) {
        // Ensure base64 doesn't have data URL prefix
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        
        const contents = [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType || 'image/jpeg',
                            data: cleanBase64
                        }
                    },
                    { text: prompt }
                ]
            }
        ];
        
        return this.request(CONFIG.GEMINI_VISION_MODEL, contents, options);
    },
    
    // Multi-turn conversation
    async chat(messages, options = {}) {
        const contents = messages.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));
        
        return this.request(CONFIG.GEMINI_MODEL, contents, options);
    },
    
    // ===== AgriGuard Specific Methods =====
    
    // The Eye - Analyze field imagery
    async analyzeField(imageBase64, mimeType, analysisOptions = {}) {
        let prompt = PROMPTS.FIELD_ANALYSIS;
        
        // Add specific analysis requests
        const analyses = [];
        if (analysisOptions.vegetation) analyses.push('detailed vegetation health analysis');
        if (analysisOptions.water) analyses.push('water stress detection');
        if (analysisOptions.pest) analyses.push('pest and disease zone identification');
        if (analysisOptions.fertilizer) analyses.push('fertilizer requirement analysis');
        
        if (analyses.length > 0) {
            prompt += `\n\nFocus especially on: ${analyses.join(', ')}.`;
        }
        
        prompt += '\n\nRespond with valid JSON format.';
        
        const response = await this.analyzeImage(imageBase64, mimeType, prompt, {
            temperature: 0.3,
            maxTokens: 4096
        });
        
        return Utils.extractJSON(response);
    },
    
    // The Specialist - Diagnose pest/disease
    async diagnosePlant(imageBase64, mimeType, additionalContext = '') {
        let prompt = PROMPTS.PEST_DIAGNOSIS;
        
        if (additionalContext) {
            prompt += `\n\nAdditional context from farmer: ${additionalContext}`;
        }
        
        console.log('🔬 Starting plant diagnosis...');
        
        const response = await this.analyzeImage(imageBase64, mimeType, prompt, {
            temperature: 0.2,
            maxTokens: 8192
        });
        
        console.log('📝 Raw AI Response:', response);
        
        const result = Utils.extractJSON(response);
        console.log('🧬 Parsed Result:', result);
        
        return result;
    },
    
    // The Strategist - Generate IPM plan
    async generateIPMStrategy(farmData) {
        let prompt = PROMPTS.IPM_STRATEGY
            .replace('{crop}', farmData.crop)
            .replace('{size}', farmData.size)
            .replace('{location}', farmData.location)
            .replace('{issues}', farmData.issues || 'None specified')
            .replace('{method}', farmData.method)
            .replace('{duration}', farmData.duration);
        
        // Add weather context if available
        if (farmData.weatherData) {
            prompt += `\n\nCurrent Weather Context:\n${JSON.stringify(farmData.weatherData, null, 2)}`;
        }
        
        prompt += '\n\nRespond with valid JSON format.';
        
        const response = await this.generateText(prompt, {
            temperature: 0.5,
            maxTokens: 8192
        });
        
        return Utils.extractJSON(response);
    },
    
    // The Partner - Conversational assistant
    async askAssistant(message, imageBase64 = null, mimeType = null, conversationHistory = []) {
        // Build conversation history
        const messages = [];
        
        // Add previous messages
        conversationHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        });
        
        // Add current message
        const currentParts = [];
        
        if (imageBase64 && mimeType) {
            currentParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: imageBase64
                }
            });
        }
        
        currentParts.push({ text: message });
        
        messages.push({
            role: 'user',
            parts: currentParts
        });
        
        return this.chat(messages, {
            systemInstruction: PROMPTS.ASSISTANT_CONTEXT,
            temperature: 0.7,
            maxTokens: 2048
        });
    },
    
    // Quick diagnosis from text description
    async quickDiagnosis(description) {
        const prompt = `As an agricultural expert, provide a quick diagnosis based on this description of plant symptoms:

"${description}"

Provide:
1. Most likely cause (pest, disease, nutrient deficiency, or environmental)
2. Confidence level (Low/Medium/High)
3. Recommended immediate action
4. Suggestion to upload a photo for more accurate diagnosis

Keep the response concise and actionable.`;
        
        return this.generateText(prompt, {
            temperature: 0.5,
            maxTokens: 1024
        });
    },
    
    // Get seasonal pest predictions
    async getSeasonalPredictions(crop, location, month) {
        const prompt = `As an IPM expert, provide seasonal pest and disease predictions for:

Crop: ${crop}
Location: ${location}
Month: ${month}

List the top 5 most likely pests/diseases to watch for this season with:
1. Name
2. Risk level (Low/Medium/High)
3. Early warning signs
4. Preventive measures

Format as JSON array.`;
        
        const response = await this.generateText(prompt, {
            temperature: 0.4,
            maxTokens: 2048
        });
        
        return Utils.extractJSON(response);
    }
};

// Export
window.GeminiAPI = GeminiAPI;
