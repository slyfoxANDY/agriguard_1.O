// The Strategist - IPM Strategy Generator Module

const StrategistModule = {
    currentStrategy: null,
    
    // Initialize module
    init() {
        this.setupEventListeners();
        this.loadForecast();
    },
    
    // Setup event listeners
    setupEventListeners() {
        const form = $('#strategy-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.generateStrategy();
            });
        }
    },
    
    // Load weather forecast
    async loadForecast() {
        const container = $('#forecast-container');
        if (!container) return;
        
        try {
            const forecast = await WeatherAPI.getForecast(7);
            this.displayForecast(forecast);
        } catch (error) {
            container.innerHTML = `
                <div class="forecast-error">
                    <p>⚠️ Unable to load forecast</p>
                    <small>Weather data will still be considered in strategy generation if available.</small>
                </div>
            `;
        }
    },
    
    // Display forecast
    displayForecast(forecast) {
        const container = $('#forecast-container');
        if (!container) return;
        
        container.innerHTML = forecast.slice(0, 5).map(day => `
            <div class="forecast-day">
                <span class="forecast-day-name">${day.dayName}</span>
                <span class="forecast-icon">${day.emoji}</span>
                <div class="forecast-temps">
                    <span class="forecast-high">${day.tempMax}°</span>
                    <span class="forecast-low">${day.tempMin}°</span>
                </div>
            </div>
        `).join('');
    },
    
    // Generate IPM strategy
    async generateStrategy() {
        if (!GeminiAPI.isConfigured()) {
            Utils.toast.error('Please configure your Gemini API key in Settings');
            return;
        }
        
        const form = $('#strategy-form');
        const btn = $('#generate-strategy-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        
        // Gather form data
        const farmData = {
            crop: $('#crop-type').value,
            size: $('#farm-size').value,
            location: $('#location').value,
            issues: $('#current-issues').value,
            method: form.querySelector('input[name="farming-method"]:checked').value,
            duration: $('#plan-duration').value
        };
        
        // Validate
        if (!farmData.crop || !farmData.size || !farmData.location) {
            Utils.toast.error('Please fill in all required fields');
            return;
        }
        
        // Show loading
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        btn.disabled = true;
        
        try {
            // Get weather data
            try {
                const weather = await WeatherAPI.getCurrentWeather();
                const forecast = await WeatherAPI.getForecast(7);
                farmData.weatherData = { current: weather, forecast };
            } catch (e) {
                console.log('Weather not available for strategy');
            }
            
            const result = await GeminiAPI.generateIPMStrategy(farmData);
            this.currentStrategy = result;
            
            // Display results
            this.displayResults(result, farmData);
            
            // Log activity
            Utils.activity.log('strategy', `IPM Strategy: ${farmData.crop}`, {
                duration: farmData.duration,
                method: farmData.method
            });
            
            Utils.toast.success('Strategy generated!');
        } catch (error) {
            Utils.toast.error('Strategy generation failed: ' + error.message);
            console.error(error);
        } finally {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            btn.disabled = false;
        }
    },
    
    // Display strategy results
    displayResults(result, farmData) {
        const resultsContainer = $('#strategy-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');
        }
        
        // Overview
        this.displayOverview(result, farmData);
        
        // Companion planting
        this.displayCompanions(result);
        
        // Risk assessment
        this.displayRiskAssessment(result);
        
        // Spray timing
        this.displaySprayTiming(result);
        
        // Action calendar
        this.displayActionCalendar(result, farmData);
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Display strategy overview
    displayOverview(result, farmData) {
        const container = $('#strategy-overview');
        if (!container) return;
        
        const overview = result.strategyOverview || result.overview || result;
        
        container.innerHTML = `
            <div class="overview-stats">
                <div class="overview-stat">
                    <div class="overview-stat-value">${farmData.duration}</div>
                    <div class="overview-stat-label">Day Plan</div>
                </div>
                <div class="overview-stat">
                    <div class="overview-stat-value">${Utils.string.capitalize(farmData.method)}</div>
                    <div class="overview-stat-label">Approach</div>
                </div>
                <div class="overview-stat">
                    <div class="overview-stat-value">${farmData.size}</div>
                    <div class="overview-stat-label">Acres</div>
                </div>
            </div>
            <div class="overview-text">
                <h4>📋 Key Objectives</h4>
                <p>${this.extractText(overview.objectives || overview.keyObjectives) || 'Optimize crop health through integrated pest management practices.'}</p>
                
                <h4>🎯 Expected Outcomes</h4>
                <p>${this.extractText(overview.outcomes || overview.expectedOutcomes) || 'Reduced pest pressure, improved crop health, and sustainable farming practices.'}</p>
                
                ${overview.resources ? `
                    <h4>📦 Resources Needed</h4>
                    <p>${this.extractText(overview.resources || overview.resourcesNeeded)}</p>
                ` : ''}
            </div>
        `;
    },
    
    // Display companion plants
    displayCompanions(result) {
        const container = $('#companions-grid');
        if (!container) return;
        
        const companions = result.companionPlanting || result.companionPlantingRecommendations || 
                          result.companions || [];
        
        if (!companions || (Array.isArray(companions) && companions.length === 0)) {
            container.innerHTML = this.getDefaultCompanions();
            return;
        }
        
        if (typeof companions === 'string') {
            container.innerHTML = `<p>${companions}</p>`;
            return;
        }
        
        container.innerHTML = companions.slice(0, 6).map(plant => `
            <div class="companion-card">
                <div class="companion-icon">${plant.emoji || plant.icon || this.getPlantEmoji(plant.name || plant)}</div>
                <div class="companion-name">${plant.name || plant.plant || plant}</div>
                <div class="companion-benefit">${plant.benefit || plant.primaryBenefit || plant.description || 'Natural pest deterrent'}</div>
            </div>
        `).join('');
    },
    
    // Get default companions if none provided
    getDefaultCompanions() {
        const defaults = [
            { emoji: '🌿', name: 'Basil', benefit: 'Repels aphids, mosquitoes, and flies' },
            { emoji: '🌼', name: 'Marigold', benefit: 'Deters nematodes and whiteflies' },
            { emoji: '🧄', name: 'Garlic', benefit: 'Natural fungicide, repels aphids' },
            { emoji: '🌻', name: 'Sunflower', benefit: 'Attracts beneficial insects' },
            { emoji: '🌱', name: 'Cilantro', benefit: 'Attracts predatory wasps' },
            { emoji: '💐', name: 'Lavender', benefit: 'Repels moths and fleas' }
        ];
        
        return defaults.map(plant => `
            <div class="companion-card">
                <div class="companion-icon">${plant.emoji}</div>
                <div class="companion-name">${plant.name}</div>
                <div class="companion-benefit">${plant.benefit}</div>
            </div>
        `).join('');
    },
    
    // Get plant emoji
    getPlantEmoji(name) {
        const plantEmojis = {
            'basil': '🌿',
            'marigold': '🌼',
            'garlic': '🧄',
            'sunflower': '🌻',
            'lavender': '💐',
            'mint': '🌿',
            'cilantro': '🌱',
            'dill': '🌿',
            'rosemary': '🌿',
            'thyme': '🌿',
            'chives': '🌱',
            'nasturtium': '🌺',
            'clover': '🍀',
            'chamomile': '🌼'
        };
        
        const nameLower = (name || '').toLowerCase();
        for (const [key, emoji] of Object.entries(plantEmojis)) {
            if (nameLower.includes(key)) return emoji;
        }
        return '🌱';
    },
    
    // Display risk assessment
    displayRiskAssessment(result) {
        const container = $('#risk-timeline');
        if (!container) return;
        
        const risks = result.predictiveRiskAssessment || result.riskAssessment || 
                     result.predictiveRisk || result.risks || [];
        
        if (!risks || (Array.isArray(risks) && risks.length === 0)) {
            container.innerHTML = this.getDefaultRisks();
            return;
        }
        
        if (typeof risks === 'string') {
            container.innerHTML = `<p>${risks}</p>`;
            return;
        }
        
        container.innerHTML = risks.slice(0, 8).map((risk, i) => {
            const level = risk.level || risk.riskLevel || this.getRiskLevel(risk);
            const levelClass = level.toLowerCase().includes('high') ? 'high' : 
                              level.toLowerCase().includes('medium') ? 'medium' : 'low';
            const percentage = levelClass === 'high' ? 85 : levelClass === 'medium' ? 55 : 25;
            
            return `
                <div class="risk-week ${levelClass}">
                    <span class="risk-week-name">${risk.week || risk.period || risk.timeframe || `Week ${i + 1}`}</span>
                    <div class="risk-week-bar">
                        <div class="risk-week-fill" style="width: ${percentage}%">
                            ${level}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Get default risks
    getDefaultRisks() {
        return `
            <div class="risk-week low">
                <span class="risk-week-name">Week 1-2</span>
                <div class="risk-week-bar">
                    <div class="risk-week-fill" style="width: 25%">Low</div>
                </div>
            </div>
            <div class="risk-week medium">
                <span class="risk-week-name">Week 3-4</span>
                <div class="risk-week-bar">
                    <div class="risk-week-fill" style="width: 55%">Medium</div>
                </div>
            </div>
            <div class="risk-week high">
                <span class="risk-week-name">Week 5-6</span>
                <div class="risk-week-bar">
                    <div class="risk-week-fill" style="width: 75%">High</div>
                </div>
            </div>
            <div class="risk-week medium">
                <span class="risk-week-name">Week 7-8</span>
                <div class="risk-week-bar">
                    <div class="risk-week-fill" style="width: 50%">Medium</div>
                </div>
            </div>
        `;
    },
    
    // Get risk level from object
    getRiskLevel(risk) {
        if (typeof risk === 'string') return risk;
        if (risk.high || risk.critical) return 'High';
        if (risk.medium || risk.moderate) return 'Medium';
        return 'Low';
    },
    
    // Display spray timing
    async displaySprayTiming(result) {
        const container = $('#timing-calendar');
        if (!container) return;
        
        const timing = result.sprayTimingOptimization || result.sprayTiming || 
                      result.timingOptimization || result.optimalTiming || [];
        
        // Try to get actual spray windows from weather
        let windows = [];
        try {
            windows = await WeatherAPI.findSprayWindows();
        } catch (e) {
            console.log('Could not fetch spray windows');
        }
        
        // Combine AI recommendations with weather windows
        let html = '';
        
        if (windows.length > 0) {
            html += `
                <h4 style="margin-bottom: 1rem;">🌤️ Optimal Windows (Weather-Based)</h4>
                ${windows.slice(0, 5).map(w => `
                    <div class="timing-window">
                        <span class="timing-icon">⏰</span>
                        <div class="timing-details">
                            <div class="timing-title">${w.date} at ${w.hour}</div>
                            <div class="timing-desc">Wind: ${w.conditions.windSpeed} km/h | Humidity: ${w.conditions.humidity}%</div>
                        </div>
                        ${w.isPrimeTime ? '<span class="timing-badge">Prime Time</span>' : ''}
                    </div>
                `).join('')}
            `;
        }
        
        if (timing && (Array.isArray(timing) ? timing.length > 0 : true)) {
            html += `
                <h4 style="margin: 1.5rem 0 1rem;">📋 Strategy Recommendations</h4>
            `;
            
            if (typeof timing === 'string') {
                html += `<p>${timing}</p>`;
            } else if (Array.isArray(timing)) {
                html += timing.map(t => `
                    <div class="timing-window">
                        <span class="timing-icon">📅</span>
                        <div class="timing-details">
                            <div class="timing-title">${t.time || t.title || t.window || 'Spray Window'}</div>
                            <div class="timing-desc">${t.description || t.conditions || t.recommendation || ''}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                html += `<p>${this.extractText(timing)}</p>`;
            }
        }
        
        if (!html) {
            html = `
                <div class="timing-window">
                    <span class="timing-icon">🌅</span>
                    <div class="timing-details">
                        <div class="timing-title">Early Morning (6-9 AM)</div>
                        <div class="timing-desc">Best for most applications. Low wind, dew present.</div>
                    </div>
                    <span class="timing-badge">Recommended</span>
                </div>
                <div class="timing-window">
                    <span class="timing-icon">🌇</span>
                    <div class="timing-details">
                        <div class="timing-title">Late Afternoon (5-7 PM)</div>
                        <div class="timing-desc">Good alternative. Cooler temperatures, reduced evaporation.</div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    // Display action calendar
    displayActionCalendar(result, farmData) {
        const container = $('#action-calendar');
        if (!container) return;
        
        const actions = result.actionCalendar || result.actionPlan || result.calendar || [];
        const duration = parseInt(farmData.duration);
        
        if (!actions || (Array.isArray(actions) && actions.length === 0)) {
            // Generate default calendar
            container.innerHTML = this.generateDefaultCalendar(duration);
            return;
        }
        
        if (typeof actions === 'string') {
            container.innerHTML = `<p>${actions}</p>`;
            return;
        }
        
        container.innerHTML = actions.slice(0, 10).map(action => {
            const date = new Date(action.date || Date.now());
            const tasks = action.tasks || action.activities || [action.task || action.action || action.description];
            
            return `
                <div class="calendar-day">
                    <div class="calendar-date">
                        <div class="calendar-date-day">${date.getDate()}</div>
                        <div class="calendar-date-month">${date.toLocaleDateString('en-US', { month: 'short' })}</div>
                    </div>
                    <div class="calendar-tasks">
                        ${(Array.isArray(tasks) ? tasks : [tasks]).map(task => {
                            const taskType = this.getTaskType(task);
                            return `<span class="calendar-task ${taskType}">${typeof task === 'object' ? task.name || task.task : task}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Generate default calendar
    generateDefaultCalendar(duration) {
        const tasks = [
            { day: 1, tasks: ['Initial field inspection', 'Install monitoring traps'], type: 'inspect' },
            { day: 7, tasks: ['Scout for pests', 'Check trap counts'], type: 'inspect' },
            { day: 14, tasks: ['Apply preventive spray', 'Update records'], type: 'spray' },
            { day: 21, tasks: ['Assess plant health', 'Adjust irrigation'], type: 'water' },
            { day: 28, tasks: ['Mid-cycle inspection', 'Companion plant check'], type: 'plant' },
            { day: 35, tasks: ['Treatment application if needed'], type: 'spray' },
            { day: 45, tasks: ['Full field assessment'], type: 'inspect' },
            { day: 60, tasks: ['Strategy review', 'Plan next cycle'], type: 'inspect' }
        ];
        
        const today = new Date();
        
        return tasks.filter(t => t.day <= duration).map(task => {
            const date = Utils.date.addDays(today, task.day);
            
            return `
                <div class="calendar-day">
                    <div class="calendar-date">
                        <div class="calendar-date-day">${date.getDate()}</div>
                        <div class="calendar-date-month">${date.toLocaleDateString('en-US', { month: 'short' })}</div>
                    </div>
                    <div class="calendar-tasks">
                        ${task.tasks.map(t => `<span class="calendar-task ${task.type}">${t}</span>`).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Get task type for styling
    getTaskType(task) {
        const taskLower = (typeof task === 'string' ? task : task.name || '').toLowerCase();
        
        if (taskLower.includes('spray') || taskLower.includes('apply') || taskLower.includes('treatment')) return 'spray';
        if (taskLower.includes('water') || taskLower.includes('irrigat')) return 'water';
        if (taskLower.includes('plant') || taskLower.includes('seed') || taskLower.includes('companion')) return 'plant';
        return 'inspect';
    },
    
    // Extract text from various formats
    extractText(data) {
        if (!data) return '';
        if (typeof data === 'string') return data;
        if (Array.isArray(data)) return data.join('. ');
        if (typeof data === 'object') {
            return data.text || data.description || data.summary || JSON.stringify(data);
        }
        return String(data);
    }
};

// Export
window.StrategistModule = StrategistModule;
