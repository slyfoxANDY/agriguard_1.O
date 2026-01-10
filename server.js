// AgriGuard Backend Server
// Node.js Express backend for secure Gemini API integration

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Log the API key being loaded
console.log('🔑 API Key loaded:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'NOT FOUND');

// Gemini API base URL - using direct REST API instead of SDK
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Helper function to call Gemini API directly via REST
async function callGeminiAPI(model, contents, options = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: contents,
        generationConfig: {
            temperature: options.temperature || 0.7,
            topK: options.topK || 40,
            topP: options.topP || 0.95,
            maxOutputTokens: options.maxTokens || 8192,
        }
    };

    if (options.systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: options.systemInstruction }]
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
        const error = new Error(data.error?.message || 'Gemini API error');
        error.status = response.status;
        error.details = data.error;
        throw error;
    }

    return data;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for image data
app.use(express.static('.')); // Serve static files from root directory

// Logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'AgriGuard API is running',
        timestamp: new Date().toISOString()
    });
});

// Main Gemini API endpoint - handles all types of requests
app.post('/api/gemini', async (req, res) => {
    try {
        const { model, contents, options = {} } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ 
                error: 'Server configuration error: API key not set' 
            });
        }

        if (!model || !contents) {
            return res.status(400).json({ 
                error: 'Missing required fields: model and contents' 
            });
        }

        console.log(`🌱 Gemini Request: model=${model}, contentParts=${contents.length}`);

        // Prepare the content for the API
        const requestContents = contents.map(content => {
            const parts = content.parts.map(part => {
                if (part.inlineData) {
                    return {
                        inlineData: {
                            mimeType: part.inlineData.mimeType,
                            data: part.inlineData.data
                        }
                    };
                }
                return part;
            });

            return {
                role: content.role || 'user',
                parts: parts
            };
        });

        // Call Gemini API via REST
        const data = await callGeminiAPI(model, requestContents, options);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('✅ Gemini Response generated successfully');

        res.json({ 
            success: true,
            text: text,
            candidates: data.candidates
        });

    } catch (error) {
        console.error('❌ Gemini API Error:', error);
        
        const errorMsg = error.message || '';
        const errorDetails = error.details || {};
        
        // Check for invalid API key
        if (errorMsg.includes('API_KEY_INVALID') || 
            errorMsg.includes('API key not valid') ||
            errorDetails.status === 'INVALID_ARGUMENT') {
            return res.status(401).json({ 
                error: 'Invalid API key. Please check your GEMINI_API_KEY in the .env file.',
                code: 'INVALID_API_KEY'
            });
        }

        // Handle safety filters
        if (errorMsg.includes('SAFETY') || errorDetails.status === 'BLOCKED') {
            return res.status(400).json({ 
                error: 'Response was blocked by safety filters. Please try with different content.',
                code: 'SAFETY_BLOCKED'
            });
        }

        // Handle rate limits
        if (errorMsg.includes('quota') || errorMsg.includes('rate') || error.status === 429) {
            return res.status(429).json({ 
                error: 'API rate limit exceeded. Please try again later.',
                code: 'RATE_LIMIT'
            });
        }

        res.status(500).json({ 
            error: error.message || 'An error occurred while processing your request',
            code: 'API_ERROR'
        });
    }
});

// Text generation endpoint (simplified)
app.post('/api/generate-text', async (req, res) => {
    try {
        const { prompt, options = {} } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Missing required field: prompt' });
        }

        const contents = [{ 
            role: 'user', 
            parts: [{ text: prompt }] 
        }];

        const data = await callGeminiAPI(
            options.model || 'gemini-2.5-flash', 
            contents, 
            options
        );
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ success: true, text });

    } catch (error) {
        console.error('❌ Text Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Image analysis endpoint (simplified)
app.post('/api/analyze-image', async (req, res) => {
    try {
        const { imageBase64, mimeType, prompt, options = {} } = req.body;

        if (!imageBase64 || !prompt) {
            return res.status(400).json({ 
                error: 'Missing required fields: imageBase64 and prompt' 
            });
        }

        // Clean base64 if it has data URL prefix
        const cleanBase64 = imageBase64.includes(',') 
            ? imageBase64.split(',')[1] 
            : imageBase64;

        const contents = [{ 
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
        }];

        const data = await callGeminiAPI(
            options.model || 'gemini-2.5-flash', 
            contents, 
            { ...options, temperature: options.temperature || 0.3 }
        );
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ success: true, text });

    } catch (error) {
        console.error('❌ Image Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chat endpoint (simplified)
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, options = {} } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ 
                error: 'Missing required field: messages (array)' 
            });
        }

        // Build contents from messages
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : (msg.role || 'user'),
            parts: msg.parts || [{ text: msg.content }]
        }));

        const data = await callGeminiAPI(
            options.model || 'gemini-2.5-flash', 
            contents, 
            options
        );
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ success: true, text });

    } catch (error) {
        console.error('❌ Chat Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Unhandled Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🌾 AgriGuard Server Started Successfully! 🌾            ║
║                                                           ║
║   Local:    http://localhost:${PORT}                       ║
║   API:      http://localhost:${PORT}/api                   ║
║                                                           ║
║   Endpoints:                                              ║
║   • POST /api/gemini        - Main Gemini endpoint        ║
║   • POST /api/generate-text - Text generation             ║
║   • POST /api/analyze-image - Image analysis              ║
║   • POST /api/chat          - Chat conversations          ║
║   • GET  /api/health        - Health check                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment!');
        console.warn('   Please add your API key to the .env file.');
    } else {
        console.log('✅ Gemini API Key configured');
    }
});
