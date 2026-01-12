// Gemini AI Integration for KrishiMitra
// Frontend client that communicates with backend API

const GeminiAPI = {
    // Backend API base URL - same origin (single port setup)
    getApiBaseUrl() {
        // Use same origin - frontend and backend on same port
        return window.location.origin;
    },
    
    // Initialize - no longer needs API key on frontend
    init() {
        console.log('🌱 GeminiAPI initialized - using backend proxy');
        return true; // Always return true since backend handles auth
    },
    
    // These methods are kept for backward compatibility but are no-ops
    setApiKey(key) {
        console.log('ℹ️ API key is now managed by backend server');
    },
    
    getApiKey() {
        return 'backend-managed';
    },
    
    // Check if API is configured - always true with backend
    isConfigured() {
        return true;
    },
    
    // Make API request via backend proxy
    async request(model, contents, options = {}) {
        const url = `${this.getApiBaseUrl()}/api/gemini`;
        
        console.log('🌱 Gemini Request (via backend):', { model, contentLength: contents.length });
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    contents,
                    options: {
                        temperature: options.temperature || 0.7,
                        topK: options.topK || 40,
                        topP: options.topP || 0.95,
                        maxTokens: options.maxTokens || 8192,
                        systemInstruction: options.systemInstruction
                    }
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ Backend API Error Response:', data);
                throw new Error(data.error || `API request failed: ${response.status}`);
            }
            
            console.log('✅ Gemini Response received via backend');
            
            // Handle the response format from our backend
            if (data.text) {
                return data.text;
            }
            
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
            
            throw new Error('Invalid response format from backend');
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
    
    // ===== KrishiMitra Specific Methods =====
    
    // The Eye - Analyze field imagery with multi-spectral simulation
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
        
        prompt += '\n\nRespond with valid JSON only. No markdown, no backticks.';
        
        console.log('🛰️ Starting multi-spectral field analysis...');
        
        const response = await this.analyzeImage(imageBase64, mimeType, prompt, {
            temperature: 0.3,
            maxTokens: 8192
        });
        
        console.log('📊 Field Analysis Raw Response:', response);
        
        const result = Utils.extractJSON(response);
        console.log('🗺️ Parsed Health Map Data:', result);
        
        return result;
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
    
    // Early Stress Detection - Analyze crop imagery
    async analyzeStress(imageBase64, mimeType) {
        const prompt = PROMPTS.STRESS_DETECTION;
        
        console.log('🔍 Analyzing crop stress from imagery...');
        
        const response = await this.analyzeImage(imageBase64, mimeType, prompt, {
            temperature: 0.2,
            maxTokens: 8192
        });
        
        console.log('📊 Stress Analysis Response:', response);
        
        const result = Utils.extractJSON(response);
        console.log('🧪 Parsed Stress Analysis:', result);
        
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
        
        // Add stress analysis context if available
        let stressContext = '';
        if (farmData.stressAnalysis) {
            stressContext = `
STRESS ANALYSIS FROM CROP IMAGERY:
${JSON.stringify(farmData.stressAnalysis, null, 2)}

IMPORTANT: Use the above stress analysis to provide CONTEXT-AWARE recommendations. The IPM strategy should directly address the detected stress indicators and predicted risks.`;
        }
        prompt = prompt.replace('{stressContext}', stressContext);
        
        // Add weather context if available
        if (farmData.weatherData) {
            prompt += `\n\nCurrent Weather Context:\n${JSON.stringify(farmData.weatherData, null, 2)}`;
        }
        
        console.log('🎯 Generating context-aware IPM strategy...');
        
        const response = await this.generateText(prompt, {
            temperature: 0.4,
            maxTokens: 12000
        });
        
        console.log('📋 IPM Strategy Response:', response);
        
        const result = Utils.extractJSON(response);
        console.log('✅ Parsed IPM Strategy:', result);
        
        return result;
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
