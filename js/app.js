// Main Application Controller for KrishiMitra

const App = {
    currentPage: 'dashboard',
    initialized: false,
    isNavigatingBack: false, // Flag to prevent pushState during back navigation
    
    // Initialize application
    async init() {
        if (this.initialized) return;
        
        console.log('🌱 Initializing KrishiMitra...');
        
        // Initialize APIs
        GeminiAPI.init();
        WeatherAPI.init();
        VoiceAPI.init();
        
        // Setup UI
        this.setupEventListeners();
        this.setupNavigation();
        this.setupHistoryNavigation(); // Setup History API for back button
        this.loadTheme();
        this.loadSettings();
        
        // Initialize modules
        EyeModule.init();
        SpecialistModule.init();
        StrategistModule.init();
        PartnerModule.init();
        
        // Load dashboard data
        await this.loadDashboardData();
        
        // Start weather alert monitoring
        WeatherAPI.startAlertMonitoring();
        
        // Hide splash screen
        this.hideSplash();
        
        this.initialized = true;
        console.log('✅ KrishiMitra initialized');
    },
    
    // Setup History API for browser/Android back button support
    setupHistoryNavigation() {
        // Set initial state for dashboard
        if (!window.history.state || !window.history.state.page) {
            window.history.replaceState({ page: 'dashboard' }, '', '#dashboard');
        } else {
            // Restore page from history state on page load/refresh
            this.currentPage = window.history.state.page;
            this.showPage(window.history.state.page, false);
        }
        
        // Listen for back/forward button presses
        window.addEventListener('popstate', (event) => {
            this.handlePopState(event);
        });
        
        // Android-specific: prevent app close on back button when not on dashboard
        document.addEventListener('backbutton', (event) => {
            if (this.currentPage !== 'dashboard') {
                event.preventDefault();
                window.history.back();
            }
        }, false);
    },
    
    // Handle browser back/forward navigation
    handlePopState(event) {
        const state = event.state;
        const page = state?.page || 'dashboard';
        
        console.log('📍 Popstate: navigating to', page);
        
        // Set flag to prevent pushState during this navigation
        this.isNavigatingBack = true;
        
        // Navigate to the page from history
        this.showPage(page, false);
        
        // Reset flag
        this.isNavigatingBack = false;
    },
    
    // Show page without modifying history (used by popstate handler)
    showPage(page, updateHistory = true) {
        // Update nav items
        $$('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        // Update pages
        $$('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
        
        // Close mobile nav
        $('#menu-toggle')?.classList.remove('active');
        $('#side-nav')?.classList.remove('open');
        
        this.currentPage = page;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Page-specific initialization
        if (page === 'strategist') {
            StrategistModule.loadForecast();
        }
        
        // Update history if needed (not during back navigation)
        if (updateHistory && !this.isNavigatingBack) {
            window.history.pushState({ page: page }, '', `#${page}`);
        }
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Menu toggle
        const menuToggle = $('#menu-toggle');
        const sideNav = $('#side-nav');
        const navOverlay = $('#nav-overlay');
        
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                menuToggle.classList.toggle('active');
                sideNav.classList.toggle('open');
            });
        }
        
        if (navOverlay) {
            navOverlay.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                sideNav.classList.remove('open');
            });
        }
        
        // Settings modal
        const settingsBtn = $('#settings-btn');
        const settingsModal = $('#settings-modal');
        const closeSettings = $('#close-settings');
        const modalOverlay = settingsModal?.querySelector('.modal-overlay');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.classList.add('open');
            });
        }
        
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsModal.classList.remove('open');
            });
        }
        
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                settingsModal.classList.remove('open');
            });
        }
        
        // Voice toggle in header
        const voiceToggle = $('#voice-toggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                this.navigateTo('partner');
            });
        }
        
        // Settings form handlers
        this.setupSettingsHandlers();
        
        // Feature card clicks
        $$('.feature-card').forEach(card => {
            card.addEventListener('click', () => {
                const feature = card.dataset.feature;
                if (feature) this.navigateTo(feature);
            });
        });
    },
    
    // Setup navigation
    setupNavigation() {
        $$('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                if (page) this.navigateTo(page);
            });
        });
    },
    
    // Navigate to page (with history push)
    navigateTo(page) {
        // Don't push duplicate states
        if (this.currentPage === page) return;
        
        // Use showPage which handles history
        this.showPage(page, true);
    },
    
    // Setup settings handlers
    setupSettingsHandlers() {
        // API Key
        const apiKeyInput = $('#api-key');
        const toggleVisibility = $('#toggle-api-key');
        const saveApiKey = $('#save-api-key');
        
        if (apiKeyInput) {
            apiKeyInput.value = GeminiAPI.getApiKey() || '';
        }
        
        if (toggleVisibility) {
            toggleVisibility.addEventListener('click', () => {
                apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
            });
        }
        
        if (saveApiKey) {
            saveApiKey.addEventListener('click', () => {
                const key = apiKeyInput.value.trim();
                if (key) {
                    GeminiAPI.setApiKey(key);
                    Utils.toast.success('API key saved successfully');
                    $('#settings-modal').classList.remove('open');
                } else {
                    Utils.toast.error('Please enter a valid API key');
                }
            });
        }
        
        // Theme
        $$('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setTheme(btn.dataset.theme);
            });
        });
        
        // Voice settings
        const voiceEnabled = $('#voice-enabled');
        const voiceSpeed = $('#voice-speed');
        const voiceSpeedValue = $('#voice-speed-value');
        
        if (voiceEnabled) {
            voiceEnabled.checked = VoiceAPI.isEnabled;
            voiceEnabled.addEventListener('change', () => {
                VoiceAPI.setEnabled(voiceEnabled.checked);
            });
        }
        
        if (voiceSpeed) {
            voiceSpeed.value = VoiceAPI.speechRate;
            if (voiceSpeedValue) voiceSpeedValue.textContent = `${VoiceAPI.speechRate}x`;
            
            voiceSpeed.addEventListener('input', () => {
                VoiceAPI.setSpeechRate(parseFloat(voiceSpeed.value));
                if (voiceSpeedValue) voiceSpeedValue.textContent = `${voiceSpeed.value}x`;
            });
        }
        
        // Location
        const detectLocation = $('#detect-location');
        const defaultLocation = $('#default-location');
        
        if (defaultLocation && WeatherAPI.getLocation()) {
            defaultLocation.value = WeatherAPI.getLocation().name;
        }
        
        if (detectLocation) {
            detectLocation.addEventListener('click', async () => {
                detectLocation.disabled = true;
                detectLocation.textContent = 'Detecting...';
                
                try {
                    const location = await WeatherAPI.detectLocation();
                    if (defaultLocation) defaultLocation.value = location.name;
                    Utils.toast.success(`Location set to ${location.name}`);
                    this.updateWeatherWidget();
                } catch (error) {
                    Utils.toast.error('Could not detect location');
                } finally {
                    detectLocation.disabled = false;
                    detectLocation.textContent = '📍 Detect My Location';
                }
            });
        }
    },
    
    // Load theme
    loadTheme() {
        const savedTheme = Utils.storage.get(CONFIG.STORAGE_KEYS.THEME, 'light');
        this.setTheme(savedTheme, false);
        
        // Update theme button
        $$('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedTheme);
        });
    },
    
    // Set theme
    setTheme(theme, save = true) {
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        
        if (save) {
            Utils.storage.set(CONFIG.STORAGE_KEYS.THEME, theme);
        }
    },
    
    // Load settings
    loadSettings() {
        // Settings are loaded in their respective handlers
    },
    
    // Load dashboard data
    async loadDashboardData() {
        // Update weather widget
        await this.updateWeatherWidget();
        
        // Load weather alerts
        await this.loadWeatherAlerts();
        
        // Update stats
        this.updateStats();
        
        // Update activity list
        this.updateActivityList();
    },
    
    // Load and display weather alerts
    async loadWeatherAlerts() {
        try {
            const alerts = await WeatherAPI.getWeatherAlerts();
            this.displayWeatherAlerts(alerts);
        } catch (error) {
            console.error('Failed to load weather alerts:', error);
        }
    },
    
    // Display weather alerts on dashboard
    displayWeatherAlerts(alerts) {
        let container = $('#weather-alerts-container');
        
        // Create container if it doesn't exist
        if (!container) {
            const dashboardPage = $('#page-dashboard');
            if (dashboardPage) {
                const alertsSection = document.createElement('div');
                alertsSection.id = 'weather-alerts-section';
                alertsSection.className = 'weather-alerts-section';
                alertsSection.innerHTML = `
                    <h2 class="section-title">🔔 Weather Alerts</h2>
                    <div id="weather-alerts-container" class="weather-alerts-container"></div>
                `;
                
                // Insert after feature grid
                const featureGrid = dashboardPage.querySelector('.feature-grid');
                if (featureGrid) {
                    featureGrid.parentNode.insertBefore(alertsSection, featureGrid.nextSibling);
                } else {
                    dashboardPage.appendChild(alertsSection);
                }
                
                container = $('#weather-alerts-container');
            }
        }
        
        if (!container) return;
        
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <span class="no-alerts-icon">✅</span>
                    <p>No weather alerts at this time</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = alerts.map(alert => `
            <div class="weather-alert alert-${alert.severity}" data-alert-id="${alert.id}">
                <div class="alert-header">
                    <span class="alert-title">${alert.title}</span>
                    <span class="alert-badge ${alert.severity}">${alert.severity.toUpperCase()}</span>
                </div>
                <p class="alert-message">${alert.message}</p>
                ${alert.advice && alert.advice.length > 0 ? `
                    <div class="alert-advice">
                        <strong>Recommended Actions:</strong>
                        <ul>
                            ${alert.advice.map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div class="alert-footer">
                    <span class="alert-time">Updated: ${new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
            </div>
        `).join('');
    },
    
    // Update weather widget
    async updateWeatherWidget() {
        const widget = $('#weather-widget');
        const weatherStatus = $('#weather-status');
        
        try {
            const weather = await WeatherAPI.getCurrentWeather();
            
            if (widget) {
                widget.querySelector('.weather-icon').textContent = weather.emoji;
                widget.querySelector('.weather-temp').textContent = `${weather.temperature}°C`;
                widget.querySelector('.weather-desc').textContent = weather.description;
            }
            
            if (weatherStatus) {
                weatherStatus.textContent = `${weather.temperature}°C`;
            }
        } catch (error) {
            console.error('Weather load error:', error);
            if (widget) {
                widget.querySelector('.weather-desc').textContent = 'Unavailable';
            }
        }
    },
    
    // Update dashboard stats
    updateStats() {
        const activities = Utils.activity.getAll();
        const analyses = activities.filter(a => a.type === 'analysis' || a.type === 'diagnosis');
        
        // Health score (average from recent analyses)
        const healthScore = $('#health-score');
        if (healthScore) {
            const scores = analyses
                .filter(a => a.details?.healthScore)
                .map(a => a.details.healthScore);
            
            if (scores.length > 0) {
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                healthScore.textContent = avg;
            } else {
                healthScore.textContent = '--';
            }
        }
        
        // Active alerts - now based on weather alerts
        const activeAlerts = $('#active-alerts');
        if (activeAlerts) {
            const alertCounts = WeatherAPI.getAlertCounts();
            const importantAlerts = alertCounts.severe + alertCounts.warning;
            activeAlerts.textContent = importantAlerts;
            
            // Add visual indicator for alerts
            if (importantAlerts > 0) {
                activeAlerts.parentElement.classList.add('has-alerts');
            } else {
                activeAlerts.parentElement.classList.remove('has-alerts');
            }
        }
        
        // Total analyses
        const totalAnalyses = $('#total-analyses');
        if (totalAnalyses) {
            totalAnalyses.textContent = analyses.length;
        }
    },
    
    // Update activity list
    updateActivityList() {
        const container = $('#activity-list');
        if (!container) return;
        
        const activities = Utils.activity.getAll();
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                    <p>No recent activity</p>
                    <span>Start by analyzing your field or diagnosing a plant</span>
                </div>
            `;
            return;
        }
        
        const icons = {
            analysis: '🛰️',
            diagnosis: '🔬',
            strategy: '🎯',
            chat: '💬'
        };
        
        container.innerHTML = activities.slice(0, 5).map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${icons[activity.type] || '📋'}</div>
                <div class="activity-info">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${Utils.date.relative(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    },
    
    // Hide splash screen
    hideSplash() {
        const splash = $('#splash-screen');
        const app = $('#app');
        
        setTimeout(() => {
            if (splash) splash.classList.add('fade-out');
            if (app) {
                app.classList.remove('hidden');
                setTimeout(() => app.classList.add('visible'), 50);
            }
            
            // Remove splash after animation
            setTimeout(() => {
                if (splash) splash.remove();
            }, 500);
        }, 2000); // Show splash for 2 seconds
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export
window.App = App;
