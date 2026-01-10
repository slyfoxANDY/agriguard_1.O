// The Specialist - Instant Diagnostic Engine Module

const SpecialistModule = {
    currentImage: null,
    currentImageMime: null,
    cameraStream: null,
    
    // Initialize module
    init() {
        this.setupEventListeners();
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Tab switching
        $$('.capture-zone .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Upload handlers
        const uploadBtn = $('#specialist-upload-btn');
        const fileInput = $('#specialist-file-input');
        const uploadZone = $('#specialist-upload-zone');
        
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
        
        // Camera handlers
        const captureBtn = $('#capture-btn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.capturePhoto());
        }
        
        // Preview handlers
        const retakeBtn = $('#specialist-retake-btn');
        const diagnoseBtn = $('#specialist-diagnose-btn');
        
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => this.retake());
        }
        
        if (diagnoseBtn) {
            diagnoseBtn.addEventListener('click', () => this.diagnose());
        }
    },
    
    // Switch tabs
    switchTab(tabName) {
        // Update tab buttons
        $$('.capture-zone .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        $$('.capture-zone .tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
        
        // Initialize camera if needed
        if (tabName === 'camera') {
            this.initCamera();
        } else {
            this.stopCamera();
        }
    },
    
    // Initialize camera
    async initCamera() {
        const video = $('#camera-feed');
        if (!video) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            this.cameraStream = stream;
            video.srcObject = stream;
        } catch (error) {
            console.error('Camera error:', error);
            Utils.toast.error('Could not access camera. Please use file upload instead.');
            this.switchTab('upload');
        }
    },
    
    // Stop camera
    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    },
    
    // Capture photo from camera
    capturePhoto() {
        const video = $('#camera-feed');
        const canvas = $('#camera-canvas');
        
        if (!video || !canvas) return;
        
        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Get image data
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        
        this.currentImage = base64;
        this.currentImageMime = 'image/jpeg';
        
        // Show preview
        this.showPreview(dataUrl);
        
        // Stop camera
        this.stopCamera();
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
            
            this.showPreview(dataUrl);
            Utils.toast.success('Image loaded successfully');
        } catch (error) {
            Utils.toast.error('Failed to load image');
            console.error(error);
        }
    },
    
    // Show preview
    showPreview(dataUrl) {
        const preview = $('#specialist-preview');
        const previewImg = $('#specialist-preview-img');
        const tabUpload = $('#tab-upload');
        const tabCamera = $('#tab-camera');
        
        if (previewImg) previewImg.src = dataUrl;
        if (preview) preview.classList.remove('hidden');
        if (tabUpload) tabUpload.classList.remove('active');
        if (tabCamera) tabCamera.classList.remove('active');
        
        // Hide tab buttons temporarily
        const tabBtns = $('.capture-tabs');
        if (tabBtns) tabBtns.style.display = 'none';
    },
    
    // Retake photo
    retake() {
        this.currentImage = null;
        this.currentImageMime = null;
        
        const preview = $('#specialist-preview');
        const tabUpload = $('#tab-upload');
        const results = $('#specialist-results');
        const fileInput = $('#specialist-file-input');
        const tabBtns = $('.capture-tabs');
        
        if (preview) preview.classList.add('hidden');
        if (tabUpload) tabUpload.classList.add('active');
        if (results) results.classList.add('hidden');
        if (fileInput) fileInput.value = '';
        if (tabBtns) tabBtns.style.display = 'flex';
        
        // Reset tab buttons
        $$('.capture-zone .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'upload');
        });
    },
    
    // Diagnose plant
    async diagnose() {
        if (!this.currentImage) {
            Utils.toast.error('Please upload or capture an image first');
            return;
        }
        
        if (!GeminiAPI.isConfigured()) {
            Utils.toast.error('Please configure your Gemini API key in Settings');
            return;
        }
        
        const diagnoseBtn = $('#specialist-diagnose-btn');
        const btnText = diagnoseBtn.querySelector('.btn-text');
        const btnLoader = diagnoseBtn.querySelector('.btn-loader');
        
        // Show loading state
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        diagnoseBtn.disabled = true;
        
        try {
            const result = await GeminiAPI.diagnosePlant(this.currentImage, this.currentImageMime);
            
            // Display results
            this.displayResults(result);
            
            // Log activity
            Utils.activity.log('diagnosis', 'Plant Diagnosis', {
                name: result.identification?.name || result.name || 'Unknown',
                confidence: result.identification?.confidence || result.confidence || 0
            });
            
            Utils.toast.success('Diagnosis complete!');
        } catch (error) {
            Utils.toast.error('Diagnosis failed: ' + error.message);
            console.error(error);
        } finally {
            // Reset button
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            diagnoseBtn.disabled = false;
        }
    },
    
    // Display diagnosis results
    displayResults(result) {
        const resultsContainer = $('#specialist-results');
        
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');
        }
        
        // Get data from various possible structures
        const identification = result.identification || result;
        const name = identification.name || identification.primaryDiagnosis || 'Unknown Issue';
        const scientificName = identification.scientificName || '';
        const confidence = identification.confidence || identification.confidenceLevel || 75;
        const description = result.description || identification.description || result.visualSymptoms || '';
        const lifecycle = result.lifecycle || result.lifecycleSpread || result.lifecycleAndSpread || '';
        const riskLevel = result.riskAssessment?.severity || result.risk?.level || result.severity || 'Moderate';
        
        // Update diagnosis header
        const diagnosisIcon = $('#diagnosis-icon');
        const diagnosisName = $('#diagnosis-name');
        const confidenceBadge = $('#confidence-badge');
        
        if (diagnosisIcon) {
            diagnosisIcon.textContent = this.getDiagnosisEmoji(name, riskLevel);
        }
        if (diagnosisName) {
            diagnosisName.innerHTML = `${name}${scientificName ? `<br><small style="font-weight:normal;color:var(--gray);font-style:italic;">${scientificName}</small>` : ''}`;
        }
        if (confidenceBadge) {
            confidenceBadge.textContent = `${confidence}% Confidence`;
            confidenceBadge.style.background = confidence >= 80 ? 'rgba(76, 175, 80, 0.1)' : 
                                               confidence >= 50 ? 'rgba(255, 193, 7, 0.1)' : 
                                               'rgba(244, 67, 54, 0.1)';
            confidenceBadge.style.color = confidence >= 80 ? 'var(--success)' : 
                                          confidence >= 50 ? 'var(--warning)' : 
                                          'var(--danger)';
        }
        
        // Update description
        const descriptionEl = $('#diagnosis-description');
        if (descriptionEl) {
            descriptionEl.textContent = typeof description === 'object' ? 
                (description.summary || description.text || JSON.stringify(description)) : 
                description;
        }
        
        // Update lifecycle
        const lifecycleEl = $('#diagnosis-lifecycle');
        if (lifecycleEl) {
            const lifecycleText = typeof lifecycle === 'object' ? 
                (lifecycle.description || lifecycle.summary || lifecycle.text || JSON.stringify(lifecycle)) : 
                lifecycle;
            lifecycleEl.textContent = lifecycleText || 'Information not available.';
        }
        
        // Update risk indicator
        this.updateRiskIndicator(riskLevel);
        
        // Update treatments
        this.updateTreatments(result);
        
        // Update prevention tips
        this.updatePreventionTips(result);
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Get emoji for diagnosis
    getDiagnosisEmoji(name, risk) {
        const nameLower = (name || '').toLowerCase();
        
        if (nameLower.includes('aphid')) return '🐛';
        if (nameLower.includes('mite')) return '🕷️';
        if (nameLower.includes('beetle')) return '🪲';
        if (nameLower.includes('caterpillar') || nameLower.includes('worm')) return '🐛';
        if (nameLower.includes('fungus') || nameLower.includes('fungal')) return '🍄';
        if (nameLower.includes('bacteria') || nameLower.includes('bacterial')) return '🦠';
        if (nameLower.includes('virus') || nameLower.includes('viral')) return '🔬';
        if (nameLower.includes('blight')) return '🍂';
        if (nameLower.includes('mildew')) return '💨';
        if (nameLower.includes('rot')) return '🤎';
        if (nameLower.includes('deficiency')) return '⚠️';
        if (nameLower.includes('healthy')) return '✅';
        
        // By risk level
        const riskLower = (risk || '').toLowerCase();
        if (riskLower.includes('critical')) return '🚨';
        if (riskLower.includes('high')) return '⚠️';
        if (riskLower.includes('moderate')) return '⚡';
        
        return '🔍';
    },
    
    // Update risk indicator
    updateRiskIndicator(riskLevel) {
        const riskFill = $('#risk-fill');
        const riskLabel = $('#risk-label');
        
        const riskLower = (riskLevel || 'moderate').toLowerCase();
        let riskClass = 'moderate';
        
        if (riskLower.includes('low')) riskClass = 'low';
        else if (riskLower.includes('high')) riskClass = 'high';
        else if (riskLower.includes('critical') || riskLower.includes('severe')) riskClass = 'critical';
        
        if (riskFill) {
            riskFill.className = `risk-fill ${riskClass}`;
        }
        
        if (riskLabel) {
            riskLabel.textContent = Utils.string.capitalize(riskClass);
            riskLabel.className = `risk-label ${riskClass}`;
        }
    },
    
    // Update treatments
    updateTreatments(result) {
        const organicContainer = $('#organic-treatments');
        const chemicalContainer = $('#chemical-treatments');
        
        // Organic treatments
        const organic = result.organicTreatments || result.organicTreatmentOptions || 
                       result.organic || result.treatments?.organic || [];
        
        if (organicContainer) {
            organicContainer.innerHTML = this.formatTreatments(organic, 'organic');
        }
        
        // Chemical treatments
        const chemical = result.chemicalTreatments || result.chemicalTreatmentOptions || 
                        result.chemical || result.treatments?.chemical || [];
        
        if (chemicalContainer) {
            chemicalContainer.innerHTML = this.formatTreatments(chemical, 'chemical');
        }
    },
    
    // Format treatments HTML
    formatTreatments(treatments, type) {
        if (!treatments || (Array.isArray(treatments) && treatments.length === 0)) {
            return '<p class="text-muted">No specific treatments recommended.</p>';
        }
        
        if (typeof treatments === 'string') {
            return `<div class="treatment-item"><p>${treatments}</p></div>`;
        }
        
        if (Array.isArray(treatments)) {
            return treatments.map(t => {
                if (typeof t === 'string') {
                    return `<div class="treatment-item"><p>${t}</p></div>`;
                }
                return `
                    <div class="treatment-item">
                        <h5>${t.name || t.treatment || t.product || 'Treatment'}</h5>
                        <p>${t.description || t.application || t.instructions || t.dosage || ''}</p>
                        ${t.timing ? `<small><strong>Timing:</strong> ${t.timing}</small>` : ''}
                        ${t.safety ? `<small><strong>Safety:</strong> ${t.safety}</small>` : ''}
                    </div>
                `;
            }).join('');
        }
        
        // Object format
        return Object.entries(treatments).map(([key, value]) => `
            <div class="treatment-item">
                <h5>${Utils.string.capitalize(key.replace(/([A-Z])/g, ' $1'))}</h5>
                <p>${typeof value === 'object' ? JSON.stringify(value) : value}</p>
            </div>
        `).join('');
    },
    
    // Update prevention tips
    updatePreventionTips(result) {
        const container = $('#prevention-tips');
        if (!container) return;
        
        const tips = result.preventionTips || result.prevention || result.preventiveMeasures || [];
        
        if (!tips || (Array.isArray(tips) && tips.length === 0)) {
            container.innerHTML = '<p class="text-muted">No specific prevention tips available.</p>';
            return;
        }
        
        if (typeof tips === 'string') {
            container.innerHTML = `<p>${tips}</p>`;
            return;
        }
        
        if (Array.isArray(tips)) {
            container.innerHTML = `
                <ul>
                    ${tips.map(tip => {
                        const text = typeof tip === 'object' ? (tip.tip || tip.description || tip.text || JSON.stringify(tip)) : tip;
                        return `<li>${text}</li>`;
                    }).join('')}
                </ul>
            `;
        }
    }
};

// Export
window.SpecialistModule = SpecialistModule;
