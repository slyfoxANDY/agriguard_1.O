// Utility Functions for KrishiMitra

const Utils = {
    // Storage utilities
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        },
        
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage error:', e);
                return defaultValue;
            }
        },
        
        remove(key) {
            localStorage.removeItem(key);
        },
        
        clear() {
            localStorage.clear();
        }
    },
    
    // Toast notifications
    toast: {
        show(message, type = 'info', duration = 4000) {
            const container = document.getElementById('toast-container');
            if (!container) return;
            
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${icons[type]}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            `;
            
            container.appendChild(toast);
            
            // Close button
            toast.querySelector('.toast-close').onclick = () => {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            };
            
            // Auto remove
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'slideIn 0.3s ease reverse';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        },
        
        success(message) { this.show(message, 'success'); },
        error(message) { this.show(message, 'error'); },
        warning(message) { this.show(message, 'warning'); },
        info(message) { this.show(message, 'info'); }
    },
    
    // File utilities
    file: {
        async toBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    // Remove the data URL prefix to get just the base64
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = error => reject(error);
            });
        },
        
        async toDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        },
        
        validateImage(file) {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'];
            if (!validTypes.includes(file.type)) {
                return { valid: false, error: 'Invalid file type. Please upload an image.' };
            }
            if (file.size > CONFIG.MAX_IMAGE_SIZE) {
                return { valid: false, error: `File too large. Maximum size is ${CONFIG.MAX_IMAGE_SIZE / (1024 * 1024)}MB.` };
            }
            return { valid: true };
        },
        
        getMimeType(file) {
            return file.type || 'image/jpeg';
        }
    },
    
    // Date utilities
    date: {
        format(date, format = 'short') {
            const d = new Date(date);
            const options = {
                short: { month: 'short', day: 'numeric' },
                medium: { month: 'short', day: 'numeric', year: 'numeric' },
                long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
                time: { hour: '2-digit', minute: '2-digit' },
                full: { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
            };
            return d.toLocaleDateString('en-US', options[format] || options.short);
        },
        
        relative(date) {
            const now = new Date();
            const d = new Date(date);
            const diff = now - d;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            return this.format(date);
        },
        
        getDayName(date) {
            return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        },
        
        addDays(date, days) {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        }
    },
    
    // DOM utilities
    dom: {
        $(selector) {
            return document.querySelector(selector);
        },
        
        $$(selector) {
            return document.querySelectorAll(selector);
        },
        
        show(element) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.remove('hidden');
        },
        
        hide(element) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.add('hidden');
        },
        
        toggle(element, show) {
            if (typeof element === 'string') element = this.$(element);
            if (element) {
                if (show === undefined) {
                    element.classList.toggle('hidden');
                } else {
                    element.classList.toggle('hidden', !show);
                }
            }
        },
        
        addClass(element, className) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.add(className);
        },
        
        removeClass(element, className) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.classList.remove(className);
        },
        
        on(element, event, handler) {
            if (typeof element === 'string') element = this.$(element);
            if (element) element.addEventListener(event, handler);
        },
        
        onAll(selector, event, handler) {
            this.$$(selector).forEach(el => el.addEventListener(event, handler));
        }
    },
    
    // String utilities
    string: {
        truncate(str, length = 100) {
            if (str.length <= length) return str;
            return str.substring(0, length) + '...';
        },
        
        capitalize(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        slugify(str) {
            return str.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }
    },
    
    // Number utilities
    number: {
        format(num, decimals = 0) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(num);
        },
        
        percentage(value, total) {
            return Math.round((value / total) * 100);
        },
        
        clamp(num, min, max) {
            return Math.min(Math.max(num, min), max);
        }
    },
    
    // Activity logging
    activity: {
        log(type, title, details = {}) {
            const activities = Utils.storage.get(CONFIG.STORAGE_KEYS.ACTIVITY, []);
            const activity = {
                id: Date.now(),
                type,
                title,
                details,
                timestamp: new Date().toISOString()
            };
            
            activities.unshift(activity);
            
            // Keep only recent activities
            if (activities.length > CONFIG.MAX_ACTIVITY_ITEMS) {
                activities.length = CONFIG.MAX_ACTIVITY_ITEMS;
            }
            
            Utils.storage.set(CONFIG.STORAGE_KEYS.ACTIVITY, activities);
            
            // Update UI if dashboard is visible
            if (typeof App !== 'undefined' && App.updateActivityList) {
                App.updateActivityList();
            }
            
            return activity;
        },
        
        getAll() {
            return Utils.storage.get(CONFIG.STORAGE_KEYS.ACTIVITY, []);
        },
        
        clear() {
            Utils.storage.remove(CONFIG.STORAGE_KEYS.ACTIVITY);
        }
    },
    
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Parse JSON safely
    parseJSON(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return fallback;
        }
    },
    
    // Extract JSON from text (useful for parsing Gemini responses)
    extractJSON(text) {
        // Try to find JSON in markdown code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1].trim());
            } catch (e) {}
        }
        
        // Try to find JSON object directly
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {}
        }
        
        // Return text as fallback
        return { rawText: text };
    },
    
    // Sleep utility
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            console.error('Copy failed:', e);
            return false;
        }
    },
    
    // Get weather emoji (with day/night support)
    getWeatherEmoji(code, isDay = true) {
        // Day weather emojis
        const dayEmojis = {
            0: '☀️', // Clear sky
            1: '🌤️', 2: '⛅', 3: '☁️', // Partly cloudy
            45: '🌫️', 48: '🌫️', // Fog
            51: '🌧️', 53: '🌧️', 55: '🌧️', // Drizzle
            61: '🌧️', 63: '🌧️', 65: '🌧️', // Rain
            71: '🌨️', 73: '🌨️', 75: '🌨️', // Snow
            80: '🌧️', 81: '🌧️', 82: '🌧️', // Showers
            95: '⛈️', 96: '⛈️', 99: '⛈️' // Thunderstorm
        };
        
        // Night weather emojis
        const nightEmojis = {
            0: '🌙', // Clear night
            1: '🌙', 2: '☁️', 3: '☁️', // Partly cloudy night
            45: '🌫️', 48: '🌫️', // Fog
            51: '🌧️', 53: '🌧️', 55: '🌧️', // Drizzle
            61: '🌧️', 63: '🌧️', 65: '🌧️', // Rain
            71: '🌨️', 73: '🌨️', 75: '🌨️', // Snow
            80: '🌧️', 81: '🌧️', 82: '🌧️', // Showers
            95: '⛈️', 96: '⛈️', 99: '⛈️' // Thunderstorm
        };
        
        const emojis = isDay ? dayEmojis : nightEmojis;
        return emojis[code] || '🌡️';
    },
    
    // Get health status color
    getHealthColor(score) {
        if (score >= 80) return 'var(--health-excellent)';
        if (score >= 60) return 'var(--health-good)';
        if (score >= 40) return 'var(--health-moderate)';
        if (score >= 20) return 'var(--health-poor)';
        return 'var(--health-critical)';
    },
    
    // Get health status text
    getHealthStatus(score) {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Moderate';
        if (score >= 20) return 'Poor';
        return 'Critical';
    }
};

// Export
window.Utils = Utils;

// Shortcuts
window.$ = Utils.dom.$;
window.$$ = Utils.dom.$$;
