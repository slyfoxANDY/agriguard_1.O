// The Strategist - IPM Strategy Generator Module

const StrategistModule = {
    currentStrategy: null,
    stressImages: [],
    stressAnalysis: null,
    
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
        
        // Stress detection image upload handlers
        this.setupStressUpload();
    },
    
    // Setup stress detection upload
    setupStressUpload() {
        const uploadZone = $('#stress-upload-zone');
        const fileInput = $('#stress-file-input');
        const clearBtn = $('#clear-stress-images');
        
        if (uploadZone) {
            uploadZone.addEventListener('click', () => fileInput?.click());
            
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('drag-over');
            });
            
            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('drag-over');
            });
            
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('drag-over');
                this.handleStressFiles(e.dataTransfer.files);
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleStressFiles(e.target.files);
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearStressImages());
        }
    },
    
    // Handle stress detection files
    async handleStressFiles(files) {
        if (!files || files.length === 0) return;
        
        for (const file of files) {
            const validation = Utils.file.validateImage(file);
            if (!validation.valid) {
                Utils.toast.error(validation.error);
                continue;
            }
            
            try {
                const dataUrl = await Utils.file.toDataURL(file);
                const base64 = await Utils.file.toBase64(file);
                
                this.stressImages.push({
                    dataUrl,
                    base64,
                    mimeType: Utils.file.getMimeType(file),
                    name: file.name
                });
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
        
        this.updateStressPreview();
        
        // Auto-analyze if images were added
        if (this.stressImages.length > 0) {
            this.analyzeStressImages();
        }
    },
    
    // Update stress preview
    updateStressPreview() {
        const preview = $('#stress-preview');
        const container = $('#preview-images');
        const uploadZone = $('#stress-upload-zone');
        
        if (this.stressImages.length === 0) {
            preview?.classList.add('hidden');
            uploadZone?.classList.remove('hidden');
            return;
        }
        
        uploadZone?.classList.add('hidden');
        preview?.classList.remove('hidden');
        
        if (container) {
            container.innerHTML = this.stressImages.map((img, idx) => `
                <div class="stress-image-preview">
                    <img src="${img.dataUrl}" alt="${img.name}">
                    <span class="image-name">${img.name}</span>
                </div>
            `).join('');
        }
    },
    
    // Clear stress images
    clearStressImages() {
        this.stressImages = [];
        this.stressAnalysis = null;
        this.updateStressPreview();
        
        const analysisSection = $('#stress-analysis');
        if (analysisSection) {
            analysisSection.classList.add('hidden');
        }
        
        const fileInput = $('#stress-file-input');
        if (fileInput) fileInput.value = '';
        
        Utils.toast.info('Images cleared');
    },
    
    // Analyze stress images
    async analyzeStressImages() {
        if (!GeminiAPI.isConfigured()) {
            Utils.toast.warning('Add API key in Settings to enable stress analysis');
            return;
        }
        
        if (this.stressImages.length === 0) return;
        
        const analysisSection = $('#stress-analysis');
        const insightsContainer = $('#stress-insights');
        
        analysisSection?.classList.remove('hidden');
        insightsContainer.innerHTML = `
            <div class="analyzing-indicator">
                <div class="spinner"></div>
                <p>Analyzing crop imagery for early stress indicators...</p>
            </div>
        `;
        
        try {
            // Analyze first image (or combine for multiple)
            const primaryImage = this.stressImages[0];
            const result = await GeminiAPI.analyzeStress(
                primaryImage.base64, 
                primaryImage.mimeType
            );
            
            this.stressAnalysis = result;
            this.displayStressAnalysis(result);
            
            Utils.toast.success('Stress analysis complete!');
        } catch (error) {
            insightsContainer.innerHTML = `
                <div class="analysis-error">
                    <p>⚠️ Unable to analyze images: ${error.message}</p>
                </div>
            `;
            console.error(error);
        }
    },
    
    // Display stress analysis results
    displayStressAnalysis(result) {
        const container = $('#stress-insights');
        if (!container) return;
        
        const health = result.overallHealth || {};
        const indicators = result.stressIndicators || [];
        const predictions = result.predictedRisks || [];
        const actions = result.immediateActions || [];
        const ipm = result.ipmRecommendations || {};
        
        const healthScore = health.score || 75;
        const healthColor = healthScore >= 80 ? 'var(--success)' : 
                           healthScore >= 60 ? 'var(--warning)' : 'var(--danger)';
        
        container.innerHTML = `
            <div class="stress-overview">
                <div class="health-gauge">
                    <svg viewBox="0 0 120 120" class="gauge-svg">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gray-light)" stroke-width="10"/>
                        <circle cx="60" cy="60" r="50" fill="none" stroke="${healthColor}" stroke-width="10"
                                stroke-dasharray="${healthScore * 3.14} 314" 
                                stroke-linecap="round" transform="rotate(-90 60 60)"/>
                        <text x="60" y="55" text-anchor="middle" font-size="24" font-weight="bold" fill="${healthColor}">${healthScore}</text>
                        <text x="60" y="75" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Health Score</text>
                    </svg>
                </div>
                <div class="health-details">
                    <h4>${health.status || 'Analysis Complete'}</h4>
                    <span class="urgency-badge urgency-${(health.urgency || 'medium').toLowerCase()}">${health.urgency || 'Medium'} Urgency</span>
                </div>
            </div>
            
            ${indicators.length > 0 ? `
                <div class="stress-indicators">
                    <h5>🔍 Detected Stress Indicators</h5>
                    ${indicators.map(ind => `
                        <div class="indicator-card ${ind.earlyWarning ? 'early-warning' : ''}">
                            <div class="indicator-header">
                                <span class="indicator-type">${ind.type}</span>
                                <span class="indicator-severity severity-${(ind.severity || 'moderate').toLowerCase()}">${ind.severity}</span>
                            </div>
                            <p class="indicator-signs">${ind.visualSigns}</p>
                            <div class="indicator-meta">
                                <span>📍 ${ind.affectedArea}</span>
                                <span>🎯 ${ind.confidence}% confidence</span>
                            </div>
                            ${ind.earlyWarning ? '<div class="early-warning-badge">⚡ Early Warning</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${predictions.length > 0 ? `
                <div class="predicted-risks">
                    <h5>⚠️ Predicted Risks</h5>
                    ${predictions.map(pred => `
                        <div class="risk-prediction">
                            <div class="risk-header">
                                <span class="risk-name">${pred.risk}</span>
                                <span class="risk-prob prob-${pred.probability?.toLowerCase()}">${pred.probability}</span>
                            </div>
                            <p>${pred.reason}</p>
                            <small>⏱️ Timeframe: ${pred.timeframe}</small>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${actions.length > 0 ? `
                <div class="immediate-actions">
                    <h5>🚀 Recommended Immediate Actions</h5>
                    <ul class="action-list">
                        ${actions.map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${Object.keys(ipm).length > 0 ? `
                <div class="ipm-preview">
                    <h5>🛡️ IPM Recommendations from Analysis</h5>
                    <div class="ipm-categories">
                        ${ipm.preventive?.length ? `
                            <div class="ipm-category">
                                <span class="category-icon">🛑</span>
                                <span class="category-name">Preventive</span>
                                <ul>${ipm.preventive.map(p => `<li>${p}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${ipm.biological?.length ? `
                            <div class="ipm-category">
                                <span class="category-icon">🐞</span>
                                <span class="category-name">Biological</span>
                                <ul>${ipm.biological.map(p => `<li>${p}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${ipm.cultural?.length ? `
                            <div class="ipm-category">
                                <span class="category-icon">🌱</span>
                                <span class="category-name">Cultural</span>
                                <ul>${ipm.cultural.map(p => `<li>${p}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="stress-note">
                <p>💡 This analysis will be integrated into your IPM strategy for context-aware recommendations.</p>
            </div>
        `;
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
        
        // Add stress analysis context if available
        if (this.stressAnalysis) {
            farmData.stressAnalysis = this.stressAnalysis;
        }
        
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
                method: farmData.method,
                hasStressAnalysis: !!this.stressAnalysis
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
        
        // Beneficial insects (new)
        this.displayBeneficialInsects(result);
        
        // Biotechnology-Enhanced IPM (new)
        this.displayBiotechIPM(result, farmData);
        
        // Risk assessment
        this.displayRiskAssessment(result);
        
        // Spray timing
        this.displaySprayTiming(result);
        
        // Action calendar
        this.displayActionCalendar(result, farmData);
        
        // Sustainability metrics (new)
        this.displaySustainability(result);
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Display strategy overview
    displayOverview(result, farmData) {
        const container = $('#strategy-overview');
        if (!container) return;
        
        const overview = result.strategyOverview || result.overview || result;
        const sustainabilityScore = overview.sustainabilityScore || 75;
        
        container.innerHTML = `
            <div class="overview-header">
                <h3>${overview.title || `Sustainable IPM Strategy for ${Utils.string.capitalize(farmData.crop)}`}</h3>
                <div class="sustainability-badge">
                    <span class="score">${sustainabilityScore}</span>
                    <span class="label">Sustainability Score</span>
                </div>
            </div>
            <p class="strategy-philosophy">${overview.philosophy || 'Prevention-first approach minimizing chemical interventions'}</p>
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
                ${this.stressAnalysis ? `
                    <div class="overview-stat stress-integrated">
                        <div class="overview-stat-value">✓</div>
                        <div class="overview-stat-label">Stress Data</div>
                    </div>
                ` : ''}
            </div>
            <div class="overview-text">
                <h4>📋 Key Objectives</h4>
                <ul class="objectives-list">
                    ${this.formatListItems(overview.objectives || ['Reduce pest pressure', 'Minimize chemical usage', 'Improve crop health'])}
                </ul>
                
                <h4>🎯 Expected Outcomes</h4>
                <ul class="outcomes-list">
                    ${this.formatListItems(overview.expectedOutcomes || ['Healthier crops', 'Reduced input costs', 'Sustainable practices'])}
                </ul>
            </div>
        `;
    },
    
    // Display beneficial insects
    displayBeneficialInsects(result) {
        const container = $('#beneficials-container');
        if (!container) return;
        
        const beneficials = result.beneficialInsects || [];
        
        if (!beneficials || beneficials.length === 0) {
            container.innerHTML = this.getDefaultBeneficials();
            return;
        }
        
        container.innerHTML = `
            <h4>🐞 Beneficial Insects</h4>
            <div class="beneficials-grid">
                ${beneficials.map(b => `
                    <div class="beneficial-card">
                        <div class="beneficial-icon">${b.emoji || '🐛'}</div>
                        <div class="beneficial-info">
                            <h5>${b.insect}</h5>
                            <p class="target-pests">Targets: ${Array.isArray(b.targetPests) ? b.targetPests.join(', ') : b.targetPests}</p>
                            <p class="release-info">📦 ${b.releaseRate}</p>
                            <p class="timing-info">⏰ ${b.timing}</p>
                            ${b.habitat ? `<p class="habitat-info">🌿 ${b.habitat}</p>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Display Biotechnology-Enhanced IPM section
    displayBiotechIPM(result, farmData) {
        const container = $('#biotech-container');
        if (!container) return;
        
        const crop = farmData?.crop?.toLowerCase() || '';
        const biotechOptions = this.getBiotechRecommendations(crop, result);
        const advantages = this.getIPMAdvantages();
        
        container.innerHTML = `
            <h3>🧬 Biotechnology-Enhanced IPM</h3>
            <p class="biotech-intro">Advanced biotechnological approaches for sustainable pest management in ${Utils.string.capitalize(crop) || 'your crop'}</p>
            
            <div class="biotech-grid">
                ${biotechOptions.map(option => `
                    <div class="biotech-card ${option.type}">
                        <div class="biotech-header">
                            <span class="biotech-icon">${option.icon}</span>
                            <span class="biotech-type-badge">${option.typeBadge}</span>
                        </div>
                        <h4 class="biotech-name">${option.name}</h4>
                        <p class="biotech-description">${option.description}</p>
                        <div class="biotech-mechanism">
                            <strong>🔬 How it works:</strong>
                            <p>${option.mechanism}</p>
                        </div>
                        <div class="biotech-benefits">
                            <strong>✅ Benefits:</strong>
                            <ul>
                                ${option.benefits.map(b => `<li>${b}</li>`).join('')}
                            </ul>
                        </div>
                        ${option.example ? `
                            <div class="biotech-example">
                                <strong>📌 Example:</strong> ${option.example}
                            </div>
                        ` : ''}
                        <div class="biotech-applicability ${option.applicable ? 'applicable' : 'general'}">
                            ${option.applicable ? `✓ Recommended for ${Utils.string.capitalize(crop)}` : '🌐 General application'}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="biotech-advantages">
                <h4>🌟 Advantages of Biotech-Enhanced IPM</h4>
                <div class="advantages-grid">
                    ${advantages.map(adv => `
                        <div class="advantage-item">
                            <span class="advantage-icon">${adv.icon}</span>
                            <div class="advantage-content">
                                <strong>${adv.title}</strong>
                                <p>${adv.description}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    // Get biotechnology recommendations based on crop
    getBiotechRecommendations(crop, result) {
        const recommendations = [];
        
        // Bt Crops - applicable for cotton, corn, brinjal
        const btCrops = ['cotton', 'corn', 'maize', 'brinjal', 'eggplant', 'soybean'];
        const isBtApplicable = btCrops.some(c => crop.includes(c));
        
        recommendations.push({
            icon: '🧬',
            name: 'Bt (Bacillus thuringiensis) Crops',
            typeBadge: 'Genetic Engineering',
            type: 'genetic',
            description: 'Plants genetically modified to produce insecticidal proteins from Bacillus thuringiensis bacterium.',
            mechanism: 'The Bt gene produces crystal proteins (Cry proteins) that are toxic to specific insect larvae. When pests ingest these proteins, they bind to receptors in the insect gut, creating pores that lead to cell death.',
            benefits: [
                'Built-in pest protection - reduces need for sprays',
                'Highly specific - targets only certain pest groups',
                'Reduces pesticide use by 60-80%',
                'Lowers farmer exposure to chemicals',
                'Cost-effective over growing season'
            ],
            example: 'Bt Cotton produces Cry1Ac and Cry2Ab proteins, providing protection against bollworms (Helicoverpa armigera) without chemical sprays.',
            applicable: isBtApplicable
        });
        
        // RNAi Technology
        const rnaiCrops = ['potato', 'corn', 'maize', 'tomato', 'soybean', 'cotton', 'wheat', 'rice'];
        const isRnaiApplicable = rnaiCrops.some(c => crop.includes(c));
        
        recommendations.push({
            icon: '🔬',
            name: 'RNA Interference (RNAi) Technology',
            typeBadge: 'Gene Silencing',
            type: 'rnai',
            description: 'Novel biotechnology that silences essential genes in pests, disrupting their vital functions.',
            mechanism: 'Double-stranded RNA (dsRNA) matching pest genes is expressed in plants or applied as spray. When pests ingest it, their cellular machinery breaks down the dsRNA into small interfering RNAs (siRNAs) that silence matching genes, disrupting pest development or survival.',
            benefits: [
                'Extremely target-specific - affects only intended pests',
                'No toxic residues in produce',
                'Can target pests resistant to conventional methods',
                'Effective against nematodes, insects, and viruses',
                'Biodegradable and environmentally safe'
            ],
            example: 'RNAi-based protection against Colorado potato beetle by silencing genes essential for beetle survival. Also used for nematode control in soybeans.',
            applicable: isRnaiApplicable
        });
        
        // Biopesticides - Trichoderma
        recommendations.push({
            icon: '🍄',
            name: 'Trichoderma Biocontrol Agents',
            typeBadge: 'Biopesticide',
            type: 'biopesticide',
            description: 'Beneficial fungus used as biocontrol agent against plant pathogens through multiple mechanisms.',
            mechanism: 'Trichoderma species (T. viride, T. harzianum) colonize plant roots and surrounding soil. They produce enzymes that degrade pathogen cell walls, compete for nutrients, parasitize other fungi, and induce systemic resistance in plants.',
            benefits: [
                'Controls soil-borne diseases (Fusarium, Pythium, Rhizoctonia)',
                'Promotes plant growth and root development',
                'Enhances nutrient uptake',
                'Safe for humans, animals, and beneficial insects',
                'Compatible with organic farming'
            ],
            example: 'Trichoderma harzianum application reduces damping-off disease in vegetables by 70-90% and improves seedling vigor.',
            applicable: true
        });
        
        // Neem-based Biopesticides
        recommendations.push({
            icon: '🌿',
            name: 'Neem-Derived Biopesticides',
            typeBadge: 'Botanical Pesticide',
            type: 'botanical',
            description: 'Azadirachtin and other compounds from neem (Azadirachta indica) with multiple modes of action against pests.',
            mechanism: 'Azadirachtin disrupts insect hormones (ecdysteroids), preventing molting and reproduction. Other neem compounds act as antifeedants, repellents, and growth regulators. This multi-modal action prevents resistance development.',
            benefits: [
                'Broad spectrum - effective against 400+ pest species',
                'Multiple modes of action prevent resistance',
                'Safe for beneficial insects when applied correctly',
                'Biodegradable - breaks down in sunlight',
                'No pre-harvest interval restrictions'
            ],
            example: 'Neem oil spray (0.3% azadirachtin) controls aphids, whiteflies, and mites while being safe for ladybugs and bees.',
            applicable: true
        });
        
        // Virus-Resistant Varieties
        const virusResistantCrops = ['papaya', 'squash', 'potato', 'tomato', 'pepper'];
        const isVirusApplicable = virusResistantCrops.some(c => crop.includes(c));
        
        recommendations.push({
            icon: '🛡️',
            name: 'Virus-Resistant Transgenic Varieties',
            typeBadge: 'Disease Resistance',
            type: 'transgenic',
            description: 'Plants engineered with viral coat protein genes or other mechanisms for immunity against devastating viral diseases.',
            mechanism: 'Pathogen-derived resistance (PDR) uses viral genes to trigger plants natural defense mechanisms. When viruses attempt infection, the plant recognizes and degrades viral RNA through post-transcriptional gene silencing.',
            benefits: [
                'Complete protection against target viruses',
                'Eliminates need for vector control',
                'Maintains crop yield and quality',
                'Reduces spread to neighboring fields',
                'One-time solution vs. repeated spraying'
            ],
            example: 'Rainbow papaya with resistance to Papaya Ringspot Virus saved the Hawaiian papaya industry from devastation.',
            applicable: isVirusApplicable
        });
        
        return recommendations;
    },
    
    // Get IPM advantages
    getIPMAdvantages() {
        return [
            {
                icon: '🌱',
                title: 'Sustainable Agriculture',
                description: 'Promotes long-term farming viability without depleting natural resources'
            },
            {
                icon: '🌍',
                title: 'Reduced Environmental Pollution',
                description: 'Minimizes chemical runoff into soil and water systems'
            },
            {
                icon: '🦋',
                title: 'Preserves Biodiversity',
                description: 'Protects natural enemies, pollinators, and beneficial organisms'
            },
            {
                icon: '💰',
                title: 'Cost-Effective',
                description: 'Lower input costs over time compared to chemical-dependent systems'
            },
            {
                icon: '❤️',
                title: 'Health Protection',
                description: 'Minimizes health risks for farmers and consumers from pesticide exposure'
            },
            {
                icon: '🔄',
                title: 'Resistance Management',
                description: 'Reduces development of pest resistance through diverse control methods'
            }
        ];
    },
    
    // Display sustainability metrics
    displaySustainability(result) {
        let container = $('#sustainability-container');
        
        // Create container if it doesn't exist
        if (!container) {
            const resultsSection = $('#strategy-results');
            if (resultsSection) {
                const sustainDiv = document.createElement('div');
                sustainDiv.className = 'sustainability-section glass-card';
                sustainDiv.id = 'sustainability-container';
                resultsSection.appendChild(sustainDiv);
                container = sustainDiv;
            }
        }
        
        if (!container) return;
        
        const metrics = result.sustainabilityMetrics || {};
        const costBenefit = result.costBenefit || {};
        
        container.innerHTML = `
            <h3>🌍 Sustainability & ROI</h3>
            <div class="sustainability-grid">
                <div class="metric-card">
                    <span class="metric-icon">🧪</span>
                    <span class="metric-value">${metrics.chemicalReduction || '60% reduction'}</span>
                    <span class="metric-label">Chemical Reduction Target</span>
                </div>
                <div class="metric-card">
                    <span class="metric-icon">🐝</span>
                    <span class="metric-value">${metrics.biodiversityGoal || '+40% beneficial insects'}</span>
                    <span class="metric-label">Biodiversity Goal</span>
                </div>
                <div class="metric-card">
                    <span class="metric-icon">💰</span>
                    <span class="metric-value">${costBenefit.estimatedSavings || '15-25% savings'}</span>
                    <span class="metric-label">Estimated Savings</span>
                </div>
                <div class="metric-card">
                    <span class="metric-icon">📈</span>
                    <span class="metric-value">${costBenefit.roi || '20% ROI improvement'}</span>
                    <span class="metric-label">Expected ROI</span>
                </div>
            </div>
            ${metrics.soilHealthPractices ? `
                <div class="soil-practices">
                    <h5>🌱 Soil Health Practices</h5>
                    <div class="practice-tags">
                        ${metrics.soilHealthPractices.map(p => `<span class="practice-tag">${p}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    },
    
    // Helper: Format list items
    formatListItems(items) {
        if (!items) return '<li>No specific items</li>';
        if (typeof items === 'string') return `<li>${items}</li>`;
        if (Array.isArray(items)) return items.map(i => `<li>${i}</li>`).join('');
        return '<li>No specific items</li>';
    },
    
    // Helper: Get default beneficials
    getDefaultBeneficials() {
        return `
            <h4>🐞 Beneficial Insects</h4>
            <div class="beneficials-grid">
                <div class="beneficial-card">
                    <div class="beneficial-icon">🐞</div>
                    <div class="beneficial-info">
                        <h5>Ladybugs</h5>
                        <p>Natural aphid predators</p>
                    </div>
                </div>
                <div class="beneficial-card">
                    <div class="beneficial-icon">🐝</div>
                    <div class="beneficial-info">
                        <h5>Pollinators</h5>
                        <p>Essential for fruit set</p>
                    </div>
                </div>
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
