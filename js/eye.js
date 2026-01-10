// The Eye - Multimodal Field Analysis Module

const EyeModule = {
    currentImage: null,
    currentImageMime: null,
    
    // Initialize module
    init() {
        this.setupEventListeners();
    },
    
    // Setup event listeners
    setupEventListeners() {
        // File input
        const fileInput = $('#eye-file-input');
        const uploadBtn = $('#eye-upload-btn');
        const uploadZone = $('#eye-upload-zone');
        const removeBtn = $('#eye-remove-btn');
        const analyzeBtn = $('#eye-analyze-btn');
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        if (uploadZone) {
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
                if (e.dataTransfer.files.length) {
                    this.handleFile(e.dataTransfer.files[0]);
                }
            });
        }
        
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeImage());
        }
        
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeField());
        }
    },
    
    // Handle file selection
    handleFileSelect(e) {
        if (e.target.files.length) {
            this.handleFile(e.target.files[0]);
        }
    },
    
    // Handle file
    async handleFile(file) {
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
            const previewImg = $('#eye-preview-img');
            const uploadContent = $('#eye-upload-zone .upload-content');
            const preview = $('#eye-preview');
            const analyzeBtn = $('#eye-analyze-btn');
            
            if (previewImg) previewImg.src = dataUrl;
            if (uploadContent) uploadContent.classList.add('hidden');
            if (preview) preview.classList.remove('hidden');
            if (analyzeBtn) analyzeBtn.disabled = false;
            
            Utils.toast.success('Image loaded successfully');
        } catch (error) {
            Utils.toast.error('Failed to load image');
            console.error(error);
        }
    },
    
    // Remove image
    removeImage() {
        this.currentImage = null;
        this.currentImageMime = null;
        
        const uploadContent = $('#eye-upload-zone .upload-content');
        const preview = $('#eye-preview');
        const analyzeBtn = $('#eye-analyze-btn');
        const results = $('#eye-results');
        const fileInput = $('#eye-file-input');
        
        if (uploadContent) uploadContent.classList.remove('hidden');
        if (preview) preview.classList.add('hidden');
        if (analyzeBtn) analyzeBtn.disabled = true;
        if (results) results.classList.add('hidden');
        if (fileInput) fileInput.value = '';
    },
    
    // Analyze field
    async analyzeField() {
        if (!this.currentImage) {
            Utils.toast.error('Please upload an image first');
            return;
        }
        
        if (!GeminiAPI.isConfigured()) {
            Utils.toast.error('Please configure your Gemini API key in Settings');
            return;
        }
        
        const analyzeBtn = $('#eye-analyze-btn');
        const btnText = analyzeBtn.querySelector('.btn-text');
        const btnLoader = analyzeBtn.querySelector('.btn-loader');
        
        // Show loading state
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        analyzeBtn.disabled = true;
        
        try {
            // Get analysis options
            const options = {
                vegetation: $('#opt-vegetation')?.checked,
                water: $('#opt-water')?.checked,
                pest: $('#opt-pest')?.checked,
                fertilizer: $('#opt-fertilizer')?.checked
            };
            
            const result = await GeminiAPI.analyzeField(this.currentImage, this.currentImageMime, options);
            
            // Display results
            this.displayResults(result);
            
            // Log activity
            Utils.activity.log('analysis', 'Field Analysis Complete', {
                healthScore: result.healthScore || result.overallHealth?.score || 75
            });
            
            Utils.toast.success('Analysis complete!');
        } catch (error) {
            Utils.toast.error('Analysis failed: ' + error.message);
            console.error(error);
        } finally {
            // Reset button
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    },
    
    // Display analysis results
    displayResults(result) {
        const resultsContainer = $('#eye-results');
        const mapDisplay = $('#health-map-display');
        const reportContent = $('#eye-report-content');
        const recommendations = $('#eye-recommendations');
        
        if (resultsContainer) resultsContainer.classList.remove('hidden');
        
        // Create health map visualization
        if (mapDisplay) {
            mapDisplay.innerHTML = this.createHealthMapVisualization(result);
        }
        
        // Display report
        if (reportContent) {
            reportContent.innerHTML = this.createReportHTML(result);
        }
        
        // Display recommendations
        if (recommendations) {
            recommendations.innerHTML = this.createRecommendationsHTML(result);
        }
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Create health map visualization
    createHealthMapVisualization(result) {
        const previewImg = $('#eye-preview-img');
        const imgSrc = previewImg ? previewImg.src : '';
        
        // Create an overlay visualization
        const zones = result.zones || result.zoneIdentification || [];
        
        let zonesHTML = '';
        if (Array.isArray(zones) && zones.length > 0) {
            zones.forEach((zone, i) => {
                const status = zone.status || zone.healthStatus || 'moderate';
                const position = this.getZonePosition(i, zones.length);
                zonesHTML += `
                    <div class="map-zone ${status.toLowerCase()}" style="top: ${position.top}%; left: ${position.left}%; width: ${position.width}%; height: ${position.height}%;">
                        <span class="zone-label">${zone.name || zone.location || `Zone ${i + 1}`}</span>
                    </div>
                `;
            });
        }
        
        return `
            <div class="health-map-container">
                <img src="${imgSrc}" alt="Field image" class="map-base-image">
                <div class="map-overlay">
                    ${zonesHTML}
                </div>
            </div>
            <style>
                .health-map-container { position: relative; display: inline-block; max-width: 100%; }
                .map-base-image { max-width: 100%; display: block; border-radius: var(--radius-md); }
                .map-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
                .map-zone { position: absolute; border: 2px solid rgba(255,255,255,0.8); border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
                .map-zone:hover { transform: scale(1.02); z-index: 10; }
                .map-zone.excellent { background: rgba(46, 125, 50, 0.4); border-color: var(--health-excellent); }
                .map-zone.good { background: rgba(102, 187, 106, 0.4); border-color: var(--health-good); }
                .map-zone.moderate { background: rgba(255, 193, 7, 0.4); border-color: var(--health-moderate); }
                .map-zone.poor { background: rgba(255, 152, 0, 0.4); border-color: var(--health-poor); }
                .map-zone.critical { background: rgba(244, 67, 54, 0.4); border-color: var(--health-critical); }
                .zone-label { background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; }
            </style>
        `;
    },
    
    // Get zone position for visualization
    getZonePosition(index, total) {
        const positions = [
            { top: 5, left: 5, width: 45, height: 45 },
            { top: 5, left: 50, width: 45, height: 45 },
            { top: 52, left: 5, width: 45, height: 45 },
            { top: 52, left: 50, width: 45, height: 45 },
            { top: 25, left: 25, width: 50, height: 50 }
        ];
        return positions[index % positions.length];
    },
    
    // Create report HTML
    createReportHTML(result) {
        const healthScore = result.healthScore || result.overallHealth?.score || result.overallHealthAssessment?.score || 75;
        const healthStatus = Utils.getHealthStatus(healthScore);
        const healthColor = Utils.getHealthColor(healthScore);
        
        let html = `
            <div class="report-section">
                <h4>🌱 Overall Health Assessment</h4>
                <div class="health-score-display">
                    <div class="score-circle" style="border-color: ${healthColor}">
                        <span class="score-value">${healthScore}</span>
                        <span class="score-label">/ 100</span>
                    </div>
                    <div class="score-info">
                        <span class="score-status" style="color: ${healthColor}">${healthStatus}</span>
                        <p>${result.overallHealth?.summary || result.overallHealthAssessment?.summary || 'Field analysis complete.'}</p>
                    </div>
                </div>
            </div>
            <style>
                .health-score-display { display: flex; align-items: center; gap: var(--spacing-lg); }
                .score-circle { width: 100px; height: 100px; border: 6px solid; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .score-value { font-size: 2rem; font-weight: 700; line-height: 1; }
                .score-label { font-size: 0.85rem; color: var(--gray); }
                .score-status { font-size: 1.25rem; font-weight: 600; display: block; margin-bottom: 0.5rem; }
            </style>
        `;
        
        // Vegetation analysis
        if (result.vegetationAnalysis || result.vegetationHealth) {
            const veg = result.vegetationAnalysis || result.vegetationHealth;
            html += `
                <div class="report-section">
                    <h4>🌿 Vegetation Analysis</h4>
                    <p>${typeof veg === 'string' ? veg : (veg.summary || veg.description || 'Analysis performed.')}</p>
                </div>
            `;
        }
        
        // Water stress
        if (result.waterStress || result.waterStressAnalysis) {
            const water = result.waterStress || result.waterStressAnalysis;
            html += `
                <div class="report-section">
                    <h4>💧 Water Stress Analysis</h4>
                    <p>${typeof water === 'string' ? water : (water.summary || water.description || 'Analysis performed.')}</p>
                </div>
            `;
        }
        
        // Pest/Disease indicators
        if (result.pestIndicators || result.pestDiseaseIndicators) {
            const pest = result.pestIndicators || result.pestDiseaseIndicators;
            html += `
                <div class="report-section">
                    <h4>🐛 Pest/Disease Indicators</h4>
                    <p>${typeof pest === 'string' ? pest : (pest.summary || pest.description || 'No immediate concerns detected.')}</p>
                </div>
            `;
        }
        
        return html;
    },
    
    // Create recommendations HTML
    createRecommendationsHTML(result) {
        const recommendations = result.recommendations || result.actionableRecommendations || result.zones || [];
        
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
            // Try to extract from rawText
            if (result.rawText) {
                return `
                    <div class="recommendation-card">
                        <div class="recommendation-header">
                            <span class="recommendation-zone">Analysis Summary</span>
                        </div>
                        <p>${result.rawText.substring(0, 1000)}...</p>
                    </div>
                `;
            }
            return '<p class="text-muted">No specific recommendations generated.</p>';
        }
        
        return recommendations.map((rec, i) => {
            const status = rec.status || rec.healthStatus || 'moderate';
            const statusClass = status.toLowerCase().includes('critical') ? 'critical' : 
                               status.toLowerCase().includes('poor') || status.toLowerCase().includes('warning') ? 'warning' : '';
            
            return `
                <div class="recommendation-card ${statusClass}">
                    <div class="recommendation-header">
                        <span class="recommendation-zone">${rec.name || rec.location || rec.zone || `Zone ${i + 1}`}</span>
                        <span class="recommendation-status">${status}</span>
                    </div>
                    <p>${rec.recommendation || rec.action || rec.description || rec.issue || 'Monitor regularly.'}</p>
                    ${rec.priority ? `<small><strong>Priority:</strong> ${rec.priority}</small>` : ''}
                </div>
            `;
        }).join('');
    }
};

// Export
window.EyeModule = EyeModule;
