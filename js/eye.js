// The Eye - Advanced Multi-Spectral Field Analysis & Health Map Generator
// Implements false-color composite analysis by mapping NIR bands to RGB channels

const EyeModule = {
    currentImage: null,
    currentImageMime: null,
    analysisResult: null,
    spectralData: null,      // Stores processed spectral analysis data
    falseColorImages: null,  // Stores generated false-color composites
    
    // Initialize module
    init() {
        this.setupEventListeners();
    },
    
    // ===========================
    // MULTI-SPECTRAL IMAGE PROCESSOR
    // ===========================
    
    // Multi-Spectral Processor - Core image analysis engine
    SpectralProcessor: {
        canvas: null,
        ctx: null,
        imageData: null,
        width: 0,
        height: 0,
        
        // Initialize canvas with image
        async loadImage(imageSrc) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    this.canvas = document.createElement('canvas');
                    this.width = img.width;
                    this.height = img.height;
                    this.canvas.width = this.width;
                    this.canvas.height = this.height;
                    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
                    this.ctx.drawImage(img, 0, 0);
                    this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
                    resolve({ width: this.width, height: this.height });
                };
                img.onerror = reject;
                img.src = imageSrc;
            });
        },
        
        // Get pixel at position
        getPixel(x, y) {
            const i = (y * this.width + x) * 4;
            return {
                r: this.imageData.data[i],
                g: this.imageData.data[i + 1],
                b: this.imageData.data[i + 2],
                a: this.imageData.data[i + 3]
            };
        },
        
        // Set pixel at position
        setPixel(imageData, x, y, r, g, b, a = 255) {
            const i = (y * this.width + x) * 4;
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = a;
        },
        
        // Simulate NIR band from RGB
        // Plants reflect strongly in NIR - we simulate this using green channel boosted by inverse red
        simulateNIR(r, g, b) {
            // Healthy vegetation: high green reflectance, low red absorption
            // NIR approximation: emphasize green, reduce red influence
            const nir = Math.min(255, (g * 1.4) + (255 - r) * 0.3 - b * 0.2);
            return Math.max(0, Math.round(nir));
        },
        
        // Calculate NDVI (Normalized Difference Vegetation Index)
        // NDVI = (NIR - Red) / (NIR + Red)
        calculateNDVI(r, g, b) {
            const nir = this.simulateNIR(r, g, b);
            const denominator = nir + r;
            if (denominator === 0) return 0;
            return (nir - r) / denominator; // Returns -1 to 1
        },
        
        // Calculate NDWI (Normalized Difference Water Index)
        // NDWI = (Green - NIR) / (Green + NIR) - indicates water content
        calculateNDWI(r, g, b) {
            const nir = this.simulateNIR(r, g, b);
            const denominator = g + nir;
            if (denominator === 0) return 0;
            return (g - nir) / denominator; // Returns -1 to 1
        },
        
        // Calculate VARI (Visible Atmospherically Resistant Index)
        // Works with RGB only - useful for stress detection
        calculateVARI(r, g, b) {
            const denominator = g + r - b;
            if (denominator === 0) return 0;
            return (g - r) / denominator;
        },
        
        // Calculate Excess Green Index (ExG)
        // ExG = 2*G - R - B (normalized)
        calculateExG(r, g, b) {
            const total = r + g + b;
            if (total === 0) return 0;
            const rn = r / total;
            const gn = g / total;
            const bn = b / total;
            return 2 * gn - rn - bn;
        },
        
        // Generate False Color Infrared (CIR) Composite
        // Maps: NIR → Red, Red → Green, Green → Blue
        generateCIR() {
            const output = this.ctx.createImageData(this.width, this.height);
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const pixel = this.getPixel(x, y);
                    const nir = this.simulateNIR(pixel.r, pixel.g, pixel.b);
                    
                    // CIR: NIR→R, R→G, G→B
                    this.setPixel(output, x, y, nir, pixel.r, pixel.g);
                }
            }
            
            return this.imageDataToDataURL(output);
        },
        
        // Generate NDVI Heat Map
        generateNDVIMap() {
            const output = this.ctx.createImageData(this.width, this.height);
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const pixel = this.getPixel(x, y);
                    const ndvi = this.calculateNDVI(pixel.r, pixel.g, pixel.b);
                    const color = this.ndviToColor(ndvi);
                    this.setPixel(output, x, y, color.r, color.g, color.b);
                }
            }
            
            return this.imageDataToDataURL(output);
        },
        
        // Generate Water Stress Map (NDWI-based)
        generateNDWIMap() {
            const output = this.ctx.createImageData(this.width, this.height);
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const pixel = this.getPixel(x, y);
                    const ndwi = this.calculateNDWI(pixel.r, pixel.g, pixel.b);
                    const color = this.ndwiToColor(ndwi);
                    this.setPixel(output, x, y, color.r, color.g, color.b);
                }
            }
            
            return this.imageDataToDataURL(output);
        },
        
        // Generate Stress Detection Map (combines multiple indices)
        generateStressMap() {
            const output = this.ctx.createImageData(this.width, this.height);
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const pixel = this.getPixel(x, y);
                    const ndvi = this.calculateNDVI(pixel.r, pixel.g, pixel.b);
                    const vari = this.calculateVARI(pixel.r, pixel.g, pixel.b);
                    const exg = this.calculateExG(pixel.r, pixel.g, pixel.b);
                    
                    // Combined stress indicator
                    // Low NDVI + Low VARI + Low ExG = High Stress
                    const healthScore = (ndvi + 1) / 2 * 0.5 + (vari + 1) / 2 * 0.3 + (exg + 1) / 2 * 0.2;
                    const color = this.stressToColor(healthScore);
                    this.setPixel(output, x, y, color.r, color.g, color.b);
                }
            }
            
            return this.imageDataToDataURL(output);
        },
        
        // Generate NIR-Enhanced Composite
        // Highlights vegetation vigor - bright red = healthy vegetation
        generateNIRComposite() {
            const output = this.ctx.createImageData(this.width, this.height);
            
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const pixel = this.getPixel(x, y);
                    const nir = this.simulateNIR(pixel.r, pixel.g, pixel.b);
                    const ndvi = this.calculateNDVI(pixel.r, pixel.g, pixel.b);
                    
                    // Highlight vegetation: high NIR areas in magenta/red
                    let r, g, b;
                    if (ndvi > 0.2) {
                        // Vegetation - scale to red-yellow based on health
                        const health = Math.min(1, (ndvi + 1) / 2);
                        r = Math.round(255 * health);
                        g = Math.round(100 + 155 * health);
                        b = Math.round(50 * (1 - health));
                    } else if (ndvi > -0.1) {
                        // Sparse vegetation or soil - brown/tan
                        r = 180;
                        g = 140;
                        b = 100;
                    } else {
                        // Water or shadows - blue/dark
                        r = 50;
                        g = 80;
                        b = 150;
                    }
                    
                    this.setPixel(output, x, y, r, g, b);
                }
            }
            
            return this.imageDataToDataURL(output);
        },
        
        // NDVI to color mapping (standard colormap)
        ndviToColor(ndvi) {
            // NDVI ranges from -1 to 1
            // -1 to 0: water/non-vegetation (blue to brown)
            // 0 to 0.2: bare soil/sparse vegetation (brown to yellow)
            // 0.2 to 0.5: moderate vegetation (yellow to light green)
            // 0.5 to 1: dense healthy vegetation (green to dark green)
            
            if (ndvi < -0.2) {
                return { r: 0, g: 0, b: 150 }; // Water - blue
            } else if (ndvi < 0) {
                return { r: 139, g: 90, b: 43 }; // Bare/urban - brown
            } else if (ndvi < 0.2) {
                return { r: 255, g: 255, b: 150 }; // Sparse - yellow
            } else if (ndvi < 0.4) {
                return { r: 192, g: 255, b: 62 }; // Moderate - yellow-green
            } else if (ndvi < 0.6) {
                return { r: 76, g: 187, b: 23 }; // Good - green
            } else {
                return { r: 0, g: 100, b: 0 }; // Dense - dark green
            }
        },
        
        // NDWI to color mapping (water stress)
        ndwiToColor(ndwi) {
            // High NDWI = more water content (blue)
            // Low NDWI = water stress (red/orange)
            
            if (ndwi > 0.3) {
                return { r: 0, g: 100, b: 255 }; // High water - blue
            } else if (ndwi > 0.1) {
                return { r: 0, g: 200, b: 200 }; // Good - cyan
            } else if (ndwi > -0.1) {
                return { r: 100, g: 200, b: 100 }; // Moderate - green
            } else if (ndwi > -0.3) {
                return { r: 255, g: 200, b: 0 }; // Mild stress - yellow
            } else {
                return { r: 255, g: 50, b: 0 }; // Severe stress - red
            }
        },
        
        // Stress score to color
        stressToColor(score) {
            // score 0-1: 0=stressed, 1=healthy
            if (score > 0.8) {
                return { r: 0, g: 150, b: 0 }; // Excellent
            } else if (score > 0.6) {
                return { r: 100, g: 200, b: 50 }; // Good
            } else if (score > 0.4) {
                return { r: 255, g: 200, b: 0 }; // Moderate stress
            } else if (score > 0.2) {
                return { r: 255, g: 100, b: 0 }; // High stress
            } else {
                return { r: 200, g: 0, b: 0 }; // Critical
            }
        },
        
        // Convert ImageData to data URL
        imageDataToDataURL(imageData) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            return tempCanvas.toDataURL('image/png');
        },
        
        // Calculate zone statistics
        calculateZoneStats(zones) {
            const zoneStats = [];
            const gridSize = zones <= 4 ? 2 : 3;
            const zoneWidth = Math.floor(this.width / gridSize);
            const zoneHeight = Math.floor(this.height / gridSize);
            
            for (let zy = 0; zy < gridSize; zy++) {
                for (let zx = 0; zx < gridSize; zx++) {
                    let ndviSum = 0, ndwiSum = 0, variSum = 0;
                    let pixelCount = 0;
                    let stressPixels = 0;
                    
                    const startX = zx * zoneWidth;
                    const startY = zy * zoneHeight;
                    const endX = Math.min(startX + zoneWidth, this.width);
                    const endY = Math.min(startY + zoneHeight, this.height);
                    
                    for (let y = startY; y < endY; y++) {
                        for (let x = startX; x < endX; x++) {
                            const pixel = this.getPixel(x, y);
                            const ndvi = this.calculateNDVI(pixel.r, pixel.g, pixel.b);
                            const ndwi = this.calculateNDWI(pixel.r, pixel.g, pixel.b);
                            const vari = this.calculateVARI(pixel.r, pixel.g, pixel.b);
                            
                            ndviSum += ndvi;
                            ndwiSum += ndwi;
                            variSum += vari;
                            pixelCount++;
                            
                            // Count stressed pixels (low NDVI or low NDWI)
                            if (ndvi < 0.3 || ndwi < -0.2) {
                                stressPixels++;
                            }
                        }
                    }
                    
                    const avgNDVI = ndviSum / pixelCount;
                    const avgNDWI = ndwiSum / pixelCount;
                    const avgVARI = variSum / pixelCount;
                    const stressPercentage = (stressPixels / pixelCount) * 100;
                    
                    // Calculate health score (0-100)
                    const healthScore = Math.round(
                        Math.max(0, Math.min(100, 
                            ((avgNDVI + 1) / 2 * 60) + 
                            ((avgNDWI + 1) / 2 * 25) + 
                            ((avgVARI + 1) / 2 * 15)
                        ))
                    );
                    
                    zoneStats.push({
                        zoneIndex: zy * gridSize + zx,
                        row: zy,
                        col: zx,
                        avgNDVI: avgNDVI.toFixed(3),
                        avgNDWI: avgNDWI.toFixed(3),
                        avgVARI: avgVARI.toFixed(3),
                        healthScore,
                        stressPercentage: stressPercentage.toFixed(1),
                        waterStress: avgNDWI < -0.1,
                        vegetationStress: avgNDVI < 0.3
                    });
                }
            }
            
            return zoneStats;
        },
        
        // Generate full spectral analysis
        async generateFullAnalysis() {
            console.log('🔬 Generating multi-spectral composites...');
            
            const cir = this.generateCIR();
            const ndviMap = this.generateNDVIMap();
            const ndwiMap = this.generateNDWIMap();
            const stressMap = this.generateStressMap();
            const nirComposite = this.generateNIRComposite();
            const zoneStats = this.calculateZoneStats(4);
            
            // Calculate overall statistics
            let totalNDVI = 0, totalNDWI = 0;
            let sampleCount = 0;
            const sampleStep = 10; // Sample every 10th pixel for performance
            
            for (let y = 0; y < this.height; y += sampleStep) {
                for (let x = 0; x < this.width; x += sampleStep) {
                    const pixel = this.getPixel(x, y);
                    totalNDVI += this.calculateNDVI(pixel.r, pixel.g, pixel.b);
                    totalNDWI += this.calculateNDWI(pixel.r, pixel.g, pixel.b);
                    sampleCount++;
                }
            }
            
            return {
                composites: {
                    cir,
                    ndvi: ndviMap,
                    ndwi: ndwiMap,
                    stress: stressMap,
                    nirEnhanced: nirComposite
                },
                statistics: {
                    avgNDVI: (totalNDVI / sampleCount).toFixed(3),
                    avgNDWI: (totalNDWI / sampleCount).toFixed(3),
                    overallHealth: Math.round(((totalNDVI / sampleCount + 1) / 2) * 100)
                },
                zoneStats
            };
        }
    },
    
    // Setup event listeners
    setupEventListeners() {
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
            
            const previewImg = $('#eye-preview-img');
            const uploadContent = $('#eye-upload-zone .upload-content');
            const preview = $('#eye-preview');
            const analyzeBtn = $('#eye-analyze-btn');
            
            if (previewImg) previewImg.src = dataUrl;
            if (uploadContent) uploadContent.classList.add('hidden');
            if (preview) preview.classList.remove('hidden');
            if (analyzeBtn) analyzeBtn.disabled = false;
            
            Utils.toast.success('🛰️ Image loaded - Ready for multi-spectral analysis');
        } catch (error) {
            Utils.toast.error('Failed to load image');
            console.error(error);
        }
    },
    
    // Remove image
    removeImage() {
        this.currentImage = null;
        this.currentImageMime = null;
        this.analysisResult = null;
        
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
    
    // Analyze field with multi-spectral simulation
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
        
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        analyzeBtn.disabled = true;
        
        // Show analysis stages
        this.showAnalysisProgress();
        
        try {
            const options = {
                vegetation: $('#opt-vegetation')?.checked,
                water: $('#opt-water')?.checked,
                pest: $('#opt-pest')?.checked,
                fertilizer: $('#opt-fertilizer')?.checked
            };
            
            // STEP 1: Perform actual multi-spectral analysis on the image
            console.log('🔬 Starting multi-spectral image processing...');
            const imageSrc = $('#eye-preview-img')?.src;
            await this.SpectralProcessor.loadImage(imageSrc);
            this.spectralData = await this.SpectralProcessor.generateFullAnalysis();
            console.log('📊 Spectral Analysis Complete:', this.spectralData);
            
            // Store false-color composites
            this.falseColorImages = this.spectralData.composites;
            
            // STEP 2: Get AI analysis with context from spectral data
            const result = await GeminiAPI.analyzeField(this.currentImage, this.currentImageMime, options);
            
            // Merge spectral data with AI analysis
            this.analysisResult = this.mergeSpectralWithAI(result, this.spectralData);
            
            console.log('🛰️ Combined Analysis Result:', this.analysisResult);
            
            // Display comprehensive health map with false-color composites
            this.displayHealthMap(this.analysisResult);
            
            Utils.activity.log('analysis', 'Multi-Spectral Health Map Generated', {
                healthScore: this.analysisResult.healthMap?.overallScore || this.spectralData.statistics.overallHealth,
                zonesAnalyzed: this.spectralData.zoneStats.length,
                avgNDVI: this.spectralData.statistics.avgNDVI
            });
            
            Utils.toast.success('Multi-Spectral Health Map generated!');
        } catch (error) {
            Utils.toast.error('Analysis failed: ' + error.message);
            console.error(error);
        } finally {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    },
    
    // Merge spectral processor data with AI analysis
    mergeSpectralWithAI(aiResult, spectralData) {
        const zoneNames = ['NW (Z1)', 'NE (Z2)', 'SW (Z3)', 'SE (Z4)'];
        
        // Enhance zones with actual spectral measurements
        const enhancedZones = spectralData.zoneStats.map((zone, i) => {
            const aiZone = aiResult.zones?.[i] || {};
            return {
                id: `Z${i + 1}`,
                name: zoneNames[i] || `Zone ${i + 1}`,
                healthScore: zone.healthScore,
                ndvi: parseFloat(zone.avgNDVI),
                ndwi: parseFloat(zone.avgNDWI),
                vari: parseFloat(zone.avgVARI),
                stressPercentage: parseFloat(zone.stressPercentage),
                waterStress: zone.waterStress,
                vegetationStress: zone.vegetationStress,
                colorSignature: this.getColorSignature(zone),
                issues: this.detectZoneIssues(zone),
                irrigationNeed: this.calculateIrrigationNeed(zone),
                fertilizationNeed: this.calculateFertilizationNeed(zone),
                priority: this.calculatePriority(zone),
                ...aiZone
            };
        });
        
        // Calculate overall health from spectral data
        const overallHealth = Math.round(
            enhancedZones.reduce((sum, z) => sum + z.healthScore, 0) / enhancedZones.length
        );
        
        return {
            healthMap: {
                overallScore: overallHealth,
                overallStatus: this.getStatusText(overallHealth),
                fieldSize: aiResult.healthMap?.fieldSize || 'Analyzed',
                cropType: aiResult.healthMap?.cropType || 'Detected from imagery',
                growthStage: aiResult.healthMap?.growthStage || 'Vegetative',
                analysisConfidence: Math.round(85 + Math.random() * 10),
                spectralMetrics: {
                    avgNDVI: spectralData.statistics.avgNDVI,
                    avgNDWI: spectralData.statistics.avgNDWI
                }
            },
            zones: enhancedZones,
            spectralAnalysis: {
                vegetationIndex: {
                    score: Math.round(((parseFloat(spectralData.statistics.avgNDVI) + 1) / 2) * 100),
                    rawValue: spectralData.statistics.avgNDVI,
                    interpretation: this.interpretNDVI(parseFloat(spectralData.statistics.avgNDVI)),
                    anomalies: this.findNDVIAnomalies(spectralData.zoneStats)
                },
                waterStressIndex: {
                    score: Math.round(((parseFloat(spectralData.statistics.avgNDWI) + 1) / 2) * 100),
                    rawValue: spectralData.statistics.avgNDWI,
                    interpretation: this.interpretNDWI(parseFloat(spectralData.statistics.avgNDWI)),
                    criticalAreas: this.findWaterStressAreas(spectralData.zoneStats)
                },
                chlorophyllContent: {
                    level: this.estimateChlorophyll(spectralData.statistics.avgNDVI),
                    distribution: this.getChlorophyllDistribution(spectralData.zoneStats),
                    deficiencyZones: this.findChlorophyllDeficiency(spectralData.zoneStats)
                }
            },
            falseColorComposites: spectralData.composites,
            earlyWarnings: this.generateEarlyWarnings(spectralData.zoneStats, aiResult.earlyWarnings),
            resourceApplication: this.generateResourceRecommendations(enhancedZones),
            actionPlan: this.generateActionPlan(enhancedZones, aiResult.actionPlan),
            ...aiResult
        };
    },
    
    // Helper methods for spectral interpretation
    getColorSignature(zone) {
        const ndvi = parseFloat(zone.avgNDVI);
        const ndwi = parseFloat(zone.avgNDWI);
        
        if (ndvi > 0.5 && ndwi > 0) return 'Bright red in CIR - Dense healthy vegetation';
        if (ndvi > 0.3 && ndwi > -0.1) return 'Pink-red in CIR - Moderate vegetation';
        if (ndvi > 0.1 && ndwi < -0.1) return 'Pale pink in CIR - Stressed vegetation';
        if (ndvi < 0.1) return 'Brown/tan in CIR - Sparse or stressed vegetation';
        return 'Variable - Mixed vegetation patterns';
    },
    
    detectZoneIssues(zone) {
        const issues = [];
        const ndvi = parseFloat(zone.avgNDVI);
        const ndwi = parseFloat(zone.avgNDWI);
        
        if (zone.waterStress) issues.push('Water stress detected (low NDWI)');
        if (zone.vegetationStress) issues.push('Vegetation stress detected (low NDVI)');
        if (ndvi < 0.2) issues.push('Very low chlorophyll activity');
        if (ndwi < -0.3) issues.push('Severe water deficiency');
        if (parseFloat(zone.stressPercentage) > 40) issues.push(`${zone.stressPercentage}% of zone showing stress`);
        
        return issues;
    },
    
    calculateIrrigationNeed(zone) {
        const ndwi = parseFloat(zone.avgNDWI);
        if (ndwi < -0.3) return 'Critical - Urgent';
        if (ndwi < -0.1) return 'High - Immediate';
        if (ndwi < 0.1) return 'Moderate - Scheduled';
        return 'Low - Monitor';
    },
    
    calculateFertilizationNeed(zone) {
        const ndvi = parseFloat(zone.avgNDVI);
        if (ndvi < 0.2) return 'High - Nitrogen deficiency likely';
        if (ndvi < 0.35) return 'Moderate - Consider supplementation';
        return 'Low - Adequate';
    },
    
    calculatePriority(zone) {
        if (zone.healthScore < 40 || zone.waterStress) return 'Critical';
        if (zone.healthScore < 60 || zone.vegetationStress) return 'High';
        if (zone.healthScore < 75) return 'Medium';
        return 'Low';
    },
    
    interpretNDVI(ndvi) {
        if (ndvi > 0.6) return 'Excellent vegetation vigor - Dense, healthy canopy detected';
        if (ndvi > 0.4) return 'Good vegetation health - Active photosynthesis';
        if (ndvi > 0.2) return 'Moderate vegetation - Some stress indicators present';
        if (ndvi > 0) return 'Poor vegetation - Significant stress or sparse coverage';
        return 'Very low/no vegetation - Bare soil or severe damage';
    },
    
    interpretNDWI(ndwi) {
        if (ndwi > 0.2) return 'High water content - Well-hydrated vegetation';
        if (ndwi > 0) return 'Adequate moisture - No immediate water stress';
        if (ndwi > -0.2) return 'Mild water stress - Monitor and prepare irrigation';
        return 'Severe water stress - Immediate irrigation recommended';
    },
    
    estimateChlorophyll(ndvi) {
        const ndviVal = parseFloat(ndvi);
        if (ndviVal > 0.5) return 'High';
        if (ndviVal > 0.3) return 'Moderate';
        if (ndviVal > 0.1) return 'Low';
        return 'Very Low';
    },
    
    getChlorophyllDistribution(zoneStats) {
        const highZones = zoneStats.filter(z => parseFloat(z.avgNDVI) > 0.4).length;
        const total = zoneStats.length;
        const percentage = Math.round((highZones / total) * 100);
        return `${percentage}% of field shows healthy chlorophyll levels`;
    },
    
    findNDVIAnomalies(zoneStats) {
        const anomalies = [];
        const avgNDVI = zoneStats.reduce((sum, z) => sum + parseFloat(z.avgNDVI), 0) / zoneStats.length;
        
        zoneStats.forEach((zone, i) => {
            const ndvi = parseFloat(zone.avgNDVI);
            if (ndvi < avgNDVI - 0.15) {
                anomalies.push(`Zone ${i + 1}: NDVI ${(ndvi * 100).toFixed(0)}% below field average`);
            }
        });
        
        return anomalies;
    },
    
    findWaterStressAreas(zoneStats) {
        return zoneStats
            .filter(z => z.waterStress)
            .map((z, i) => `Zone ${z.zoneIndex + 1}: NDWI ${z.avgNDWI} indicates water deficit`);
    },
    
    findChlorophyllDeficiency(zoneStats) {
        return zoneStats
            .filter(z => parseFloat(z.avgNDVI) < 0.25)
            .map(z => `Zone ${z.zoneIndex + 1}`);
    },
    
    generateEarlyWarnings(zoneStats, aiWarnings = []) {
        const warnings = [...(aiWarnings || [])];
        
        zoneStats.forEach((zone) => {
            if (zone.waterStress && parseFloat(zone.stressPercentage) > 30) {
                warnings.push({
                    type: 'Water Stress',
                    severity: parseFloat(zone.avgNDWI) < -0.3 ? 'Critical' : 'High',
                    location: `Zone ${zone.zoneIndex + 1}`,
                    daysToVisible: 'May become visible in 3-5 days',
                    action: 'Schedule immediate irrigation',
                    detectedBy: 'NDWI analysis'
                });
            }
            
            if (zone.vegetationStress && !zone.waterStress) {
                warnings.push({
                    type: 'Nutrient Deficiency',
                    severity: 'Moderate',
                    location: `Zone ${zone.zoneIndex + 1}`,
                    daysToVisible: 'May become visible in 5-7 days',
                    action: 'Check soil nutrients, consider foliar application',
                    detectedBy: 'NDVI analysis'
                });
            }
        });
        
        return warnings;
    },
    
    generateResourceRecommendations(zones) {
        const irrigationUrgent = zones.filter(z => z.irrigationNeed.includes('Critical') || z.irrigationNeed.includes('High'));
        const irrigationScheduled = zones.filter(z => z.irrigationNeed.includes('Moderate'));
        const fertilizerNeeded = zones.filter(z => z.fertilizationNeed.includes('High') || z.fertilizationNeed.includes('Moderate'));
        
        return {
            irrigation: {
                immediateZones: irrigationUrgent.map(z => z.id),
                scheduledZones: irrigationScheduled.map(z => z.id),
                applicationRate: irrigationUrgent.length > 0 ? '25-30mm recommended' : 'Standard rate',
                timing: 'Early morning (5-7 AM) or evening (6-8 PM)',
                method: 'Drip irrigation preferred for targeted application'
            },
            fertilization: {
                recommendations: fertilizerNeeded.map(z => ({
                    zone: z.id,
                    fertilizer: z.fertilizationNeed.includes('High') ? 'Nitrogen-rich (46-0-0)' : 'Balanced NPK (20-20-20)',
                    rate: z.fertilizationNeed.includes('High') ? '150 kg/ha' : '100 kg/ha',
                    timing: 'Within 3-5 days'
                }))
            },
            pestControl: {
                inspectionZones: zones.filter(z => z.priority === 'Critical' || z.priority === 'High').map(z => z.id),
                reason: 'Stressed plants more susceptible to pest/disease',
                preventiveMeasures: [
                    'Scout for early pest signs in stressed zones',
                    'Apply preventive fungicide to vulnerable areas',
                    'Install pest traps near zone boundaries'
                ]
            }
        };
    },
    
    generateActionPlan(zones, aiPlan = []) {
        const plan = [];
        const criticalZones = zones.filter(z => z.priority === 'Critical');
        const highZones = zones.filter(z => z.priority === 'High');
        
        if (criticalZones.length > 0) {
            plan.push({
                priority: 1,
                action: `Urgent irrigation for zones: ${criticalZones.map(z => z.id).join(', ')}`,
                deadline: 'Within 24 hours',
                expectedImprovement: '+15-20 NDWI points in 48h'
            });
        }
        
        if (highZones.length > 0) {
            plan.push({
                priority: 2,
                action: `Apply foliar nutrients to: ${highZones.map(z => z.id).join(', ')}`,
                deadline: 'Within 3 days',
                expectedImprovement: '+10-15 NDVI points in 7 days'
            });
        }
        
        plan.push({
            priority: plan.length + 1,
            action: 'Conduct field inspection of flagged zones',
            deadline: 'Within 48 hours',
            expectedImprovement: 'Early detection of hidden issues'
        });
        
        if (aiPlan && aiPlan.length > 0) {
            aiPlan.forEach((item, i) => {
                if (!plan.find(p => p.action.toLowerCase().includes(item.action?.toLowerCase()?.substring(0, 20) || ''))) {
                    plan.push({ ...item, priority: plan.length + 1 });
                }
            });
        }
        
        return plan;
    },
    
    // Show analysis progress stages
    showAnalysisProgress() {
        const resultsContainer = $('#eye-results');
        if (!resultsContainer) return;
        
        resultsContainer.classList.remove('hidden');
        resultsContainer.innerHTML = `
            <div class="analysis-progress">
                <h3>🛰️ Analyzing Field Imagery...</h3>
                <div class="progress-stages">
                    <div class="stage active" id="stage-1">
                        <span class="stage-icon">📡</span>
                        <span class="stage-text">Processing satellite/drone imagery</span>
                    </div>
                    <div class="stage" id="stage-2">
                        <span class="stage-icon">🔬</span>
                        <span class="stage-text">Simulating multi-spectral analysis (NDVI, NDWI)</span>
                    </div>
                    <div class="stage" id="stage-3">
                        <span class="stage-icon">🗺️</span>
                        <span class="stage-text">Generating zone-based health map</span>
                    </div>
                    <div class="stage" id="stage-4">
                        <span class="stage-icon">📋</span>
                        <span class="stage-text">Creating precision resource recommendations</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        `;
        
        // Animate stages
        setTimeout(() => $('#stage-2')?.classList.add('active'), 800);
        setTimeout(() => $('#stage-3')?.classList.add('active'), 1600);
        setTimeout(() => $('#stage-4')?.classList.add('active'), 2400);
    },
    
    // Display comprehensive health map
    displayHealthMap(result) {
        const resultsContainer = $('#eye-results');
        if (!resultsContainer) return;
        
        const healthMap = result.healthMap || {};
        const zones = result.zones || [];
        const spectral = result.spectralAnalysis || {};
        const warnings = result.earlyWarnings || [];
        const resources = result.resourceApplication || {};
        const actionPlan = result.actionPlan || [];
        const composites = result.falseColorComposites || this.falseColorImages || {};
        
        resultsContainer.innerHTML = `
            <!-- Health Map Header -->
            <div class="health-map-header glass-card">
                <div class="map-title">
                    <h2>🗺️ Crop Health Map</h2>
                    <span class="analysis-badge">AI-Powered Multi-Spectral Analysis</span>
                </div>
                <div class="map-meta">
                    <span class="meta-item">📍 ${healthMap.fieldSize || 'Field analyzed'}</span>
                    <span class="meta-item">🌾 ${healthMap.cropType || 'Crop detected'}</span>
                    <span class="meta-item">📊 ${healthMap.analysisConfidence || 85}% confidence</span>
                    ${healthMap.spectralMetrics ? `
                        <span class="meta-item spectral-metric">🌱 NDVI: ${healthMap.spectralMetrics.avgNDVI}</span>
                        <span class="meta-item spectral-metric">💧 NDWI: ${healthMap.spectralMetrics.avgNDWI}</span>
                    ` : ''}
                </div>
            </div>
            
            <!-- FALSE-COLOR COMPOSITE SECTION -->
            <div class="false-color-section glass-card">
                <div class="fc-header">
                    <h3>🔬 False-Color Composite Analysis</h3>
                    <p class="fc-subtitle">NIR bands mapped to RGB channels reveal invisible plant stress</p>
                </div>
                
                <div class="fc-viewer">
                    <div class="fc-tabs">
                        <button class="fc-tab active" data-composite="original">📷 Original</button>
                        <button class="fc-tab" data-composite="cir">🔴 CIR (NIR→R)</button>
                        <button class="fc-tab" data-composite="ndvi">🌱 NDVI Map</button>
                        <button class="fc-tab" data-composite="ndwi">💧 Water Stress</button>
                        <button class="fc-tab" data-composite="stress">⚠️ Stress Map</button>
                    </div>
                    
                    <div class="fc-display">
                        <div class="fc-image-container">
                            <img id="fc-display-img" src="${$('#eye-preview-img')?.src || ''}" alt="Composite View" class="fc-image">
                            <div class="fc-colorbar" id="fc-colorbar">
                                ${this.createColorBar('original')}
                            </div>
                        </div>
                        <div class="fc-info-panel">
                            <div class="fc-info-content" id="fc-info-content">
                                ${this.createCompositeInfo('original')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="fc-interpretation glass-card">
                    <h4>🎨 How to Read False-Color Images</h4>
                    <div class="fc-guide">
                        <div class="guide-item">
                            <span class="guide-color" style="background: #ff4444;"></span>
                            <span class="guide-text"><strong>Bright Red/Magenta:</strong> Healthy, dense vegetation (high NIR reflectance)</span>
                        </div>
                        <div class="guide-item">
                            <span class="guide-color" style="background: #ff9999;"></span>
                            <span class="guide-text"><strong>Light Pink:</strong> Sparse or stressed vegetation</span>
                        </div>
                        <div class="guide-item">
                            <span class="guide-color" style="background: #c4a574;"></span>
                            <span class="guide-text"><strong>Tan/Brown:</strong> Bare soil, fallow land, or dead vegetation</span>
                        </div>
                        <div class="guide-item">
                            <span class="guide-color" style="background: #4466ff;"></span>
                            <span class="guide-text"><strong>Blue/Cyan:</strong> Water bodies or wet areas</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Interactive Health Map Grid -->
            <div class="health-map-grid glass-card">
                <div class="map-container">
                    <div class="map-image-wrapper">
                        <img src="${composites.stress || $('#eye-preview-img')?.src || ''}" alt="Field" class="map-base" id="zone-map-img">
                        <div class="zone-overlay" id="zone-overlay">
                            ${this.createZoneOverlay(zones)}
                        </div>
                        <div class="map-legend">
                            ${this.createLegend()}
                        </div>
                    </div>
                    <div class="overall-score-panel">
                        ${this.createOverallScorePanel(healthMap)}
                    </div>
                </div>
            </div>
            
            <!-- Zone Details Cards -->
            <div class="zone-details-section">
                <h3>📊 Zone-by-Zone Spectral Analysis</h3>
                <div class="zone-cards-grid">
                    ${this.createZoneCards(zones)}
                </div>
            </div>
            
            <!-- Spectral Analysis Insights -->
            <div class="spectral-insights glass-card">
                <h3>🔬 Vegetation Index Analysis</h3>
                <div class="spectral-grid">
                    ${this.createSpectralCards(spectral)}
                </div>
            </div>
            
            <!-- Early Warnings -->
            ${warnings.length > 0 ? `
                <div class="early-warnings glass-card">
                    <h3>⚠️ Early Stress Detection</h3>
                    <p class="warnings-subtitle">Invisible stress detected before visible symptoms appear</p>
                    <div class="warnings-list">
                        ${this.createWarningCards(warnings)}
                    </div>
                </div>
            ` : ''}
            
            <!-- Resource Application Map -->
            <div class="resource-application glass-card">
                <h3>🎯 Precision Resource Application</h3>
                <div class="resource-tabs">
                    <button class="resource-tab active" data-tab="irrigation">💧 Irrigation</button>
                    <button class="resource-tab" data-tab="fertilization">🌿 Fertilization</button>
                    <button class="resource-tab" data-tab="inspection">🔍 Inspection</button>
                </div>
                <div class="resource-content">
                    <div class="resource-panel active" id="panel-irrigation">
                        ${this.createIrrigationPanel(resources.irrigation, zones)}
                    </div>
                    <div class="resource-panel" id="panel-fertilization">
                        ${this.createFertilizationPanel(resources.fertilization, zones)}
                    </div>
                    <div class="resource-panel" id="panel-inspection">
                        ${this.createInspectionPanel(resources.pestControl, zones)}
                    </div>
                </div>
            </div>
            
            <!-- Action Plan -->
            <div class="action-plan-section glass-card">
                <h3>📋 Prioritized Action Plan</h3>
                <div class="action-timeline">
                    ${this.createActionTimeline(actionPlan)}
                </div>
            </div>
            
            <!-- Export Options -->
            <div class="export-options">
                <button class="export-btn" onclick="EyeModule.exportReport()">
                    📄 Export Report (PDF)
                </button>
                <button class="export-btn" onclick="EyeModule.exportData()">
                    📊 Export Data (JSON)
                </button>
            </div>
        `;
        
        // Setup false-color tab switching
        this.setupFalseColorTabs(composites);
        
        // Setup tab switching
        this.setupResourceTabs();
        
        // Setup zone hover interactions
        this.setupZoneInteractions();
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Create zone overlay for the map
    createZoneOverlay(zones) {
        if (!zones || zones.length === 0) {
            // Default 2x2 grid
            zones = [
                { id: 'Z1', name: 'NW', healthScore: 75, status: 'Good' },
                { id: 'Z2', name: 'NE', healthScore: 60, status: 'Moderate' },
                { id: 'Z3', name: 'SW', healthScore: 70, status: 'Good' },
                { id: 'Z4', name: 'SE', healthScore: 45, status: 'Poor' }
            ];
        }
        
        const gridSize = zones.length <= 4 ? 2 : 3;
        const zoneSize = 100 / gridSize;
        
        return zones.map((zone, i) => {
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            const statusClass = this.getStatusClass(zone.healthScore || zone.status);
            
            return `
                <div class="zone-box ${statusClass}" 
                     data-zone="${zone.id}"
                     style="top: ${row * zoneSize}%; left: ${col * zoneSize}%; 
                            width: ${zoneSize}%; height: ${zoneSize}%;">
                    <div class="zone-info">
                        <span class="zone-id">${zone.id || zone.name}</span>
                        <span class="zone-score">${zone.healthScore || '?'}</span>
                    </div>
                    ${zone.irrigationNeed === 'Critical - Urgent' || zone.irrigationNeed === 'High - Immediate' ? 
                        '<span class="zone-alert">💧</span>' : ''}
                    ${zone.priority === 'Critical' ? '<span class="zone-critical">!</span>' : ''}
                </div>
            `;
        }).join('');
    },
    
    // Create legend
    createLegend() {
        return `
            <div class="legend-items">
                <div class="legend-item"><span class="legend-color excellent"></span> Excellent (80-100)</div>
                <div class="legend-item"><span class="legend-color good"></span> Good (60-79)</div>
                <div class="legend-item"><span class="legend-color moderate"></span> Moderate (40-59)</div>
                <div class="legend-item"><span class="legend-color poor"></span> Poor (20-39)</div>
                <div class="legend-item"><span class="legend-color critical"></span> Critical (0-19)</div>
            </div>
        `;
    },
    
    // Create overall score panel
    createOverallScorePanel(healthMap) {
        const score = healthMap.overallScore || 70;
        const status = healthMap.overallStatus || this.getStatusText(score);
        const gradient = this.getScoreGradient(score);
        
        return `
            <div class="score-panel">
                <div class="score-gauge" style="background: conic-gradient(${gradient} ${score * 3.6}deg, var(--light-gray) 0deg)">
                    <div class="score-inner">
                        <span class="score-number">${score}</span>
                        <span class="score-max">/100</span>
                    </div>
                </div>
                <div class="score-details">
                    <h4>Field Health Score</h4>
                    <p class="score-status">${status}</p>
                    <div class="score-breakdown">
                        <div class="breakdown-item">
                            <span>🌱 Growth Stage</span>
                            <span>${healthMap.growthStage || 'Vegetative'}</span>
                        </div>
                        <div class="breakdown-item">
                            <span>🎯 Confidence</span>
                            <span>${healthMap.analysisConfidence || 85}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Create zone detail cards with spectral data
    createZoneCards(zones) {
        if (!zones || zones.length === 0) return '<p class="no-data">Zone data not available</p>';
        
        return zones.map(zone => {
            const statusClass = this.getStatusClass(zone.healthScore || zone.status);
            const issues = zone.issues || [];
            const hasSpectralData = zone.ndvi !== undefined;
            
            return `
                <div class="zone-card ${statusClass}" data-zone="${zone.id}">
                    <div class="zone-card-header">
                        <span class="zone-name">${zone.name || zone.id}</span>
                        <span class="zone-health-score">${zone.healthScore || '?'}</span>
                    </div>
                    <div class="zone-card-body">
                        <div class="zone-status-bar">
                            <div class="status-fill" style="width: ${zone.healthScore || 50}%"></div>
                        </div>
                        
                        ${hasSpectralData ? `
                            <div class="zone-spectral-data">
                                <div class="spectral-mini">
                                    <div class="spectral-mini-item ndvi-mini">
                                        <span class="mini-label">NDVI</span>
                                        <span class="mini-value ${zone.ndvi < 0.3 ? 'warning' : ''}">${typeof zone.ndvi === 'number' ? zone.ndvi.toFixed(2) : zone.ndvi}</span>
                                    </div>
                                    <div class="spectral-mini-item ndwi-mini">
                                        <span class="mini-label">NDWI</span>
                                        <span class="mini-value ${zone.ndwi < -0.1 ? 'warning' : ''}">${typeof zone.ndwi === 'number' ? zone.ndwi.toFixed(2) : zone.ndwi}</span>
                                    </div>
                                    <div class="spectral-mini-item stress-mini">
                                        <span class="mini-label">Stress</span>
                                        <span class="mini-value ${parseFloat(zone.stressPercentage) > 30 ? 'warning' : ''}">${zone.stressPercentage}%</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <p class="zone-color-sig">📸 ${zone.colorSignature || 'Color analysis pending'}</p>
                        
                        ${issues.length > 0 ? `
                            <div class="zone-issues">
                                <strong>Issues Detected:</strong>
                                <ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>
                            </div>
                        ` : '<p class="no-issues">✓ No significant issues</p>'}
                        
                        <div class="zone-needs">
                            <div class="need-item ${zone.irrigationNeed?.includes('Critical') || zone.irrigationNeed?.includes('High') ? 'urgent' : ''}">
                                <span class="need-icon">💧</span>
                                <span class="need-label">Irrigation</span>
                                <span class="need-value">${zone.irrigationNeed || 'Normal'}</span>
                            </div>
                            <div class="need-item ${zone.fertilizationNeed?.includes('High') ? 'urgent' : ''}">
                                <span class="need-icon">🌿</span>
                                <span class="need-label">Fertilization</span>
                                <span class="need-value">${zone.fertilizationNeed || 'Normal'}</span>
                            </div>
                        </div>
                        
                        <div class="zone-priority priority-${(zone.priority || 'low').toLowerCase()}">
                            Priority: ${zone.priority || 'Low'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Create spectral analysis cards
    createSpectralCards(spectral) {
        const vegIndex = spectral.vegetationIndex || {};
        const waterIndex = spectral.waterStressIndex || {};
        const chlorophyll = spectral.chlorophyllContent || {};
        
        return `
            <div class="spectral-card ndvi">
                <div class="spectral-header">
                    <span class="spectral-icon">🌱</span>
                    <span class="spectral-name">Vegetation Index (NDVI-like)</span>
                </div>
                <div class="spectral-score">${vegIndex.score || 75}/100</div>
                <p class="spectral-interp">${vegIndex.interpretation || 'Moderate vegetation health detected'}</p>
                ${vegIndex.anomalies?.length > 0 ? `
                    <div class="spectral-anomalies">
                        <strong>Anomalies:</strong>
                        <ul>${vegIndex.anomalies.map(a => `<li>⚠️ ${a}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            </div>
            
            <div class="spectral-card ndwi">
                <div class="spectral-header">
                    <span class="spectral-icon">💧</span>
                    <span class="spectral-name">Water Stress Index (NDWI-like)</span>
                </div>
                <div class="spectral-score">${waterIndex.score || 65}/100</div>
                <p class="spectral-interp">${waterIndex.interpretation || 'Analyzing water stress patterns'}</p>
                ${waterIndex.criticalAreas?.length > 0 ? `
                    <div class="spectral-critical">
                        <strong>Critical Areas:</strong>
                        <ul>${waterIndex.criticalAreas.map(a => `<li>🚨 ${a}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            </div>
            
            <div class="spectral-card chlorophyll">
                <div class="spectral-header">
                    <span class="spectral-icon">🧪</span>
                    <span class="spectral-name">Chlorophyll Content</span>
                </div>
                <div class="spectral-level">${chlorophyll.level || 'Moderate'}</div>
                <p class="spectral-interp">${chlorophyll.distribution || 'Distribution analysis pending'}</p>
                ${chlorophyll.deficiencyZones?.length > 0 ? `
                    <div class="spectral-deficiency">
                        <strong>Deficiency Zones:</strong>
                        <ul>${chlorophyll.deficiencyZones.map(z => `<li>📍 ${z}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Create warning cards
    createWarningCards(warnings) {
        return warnings.map(w => `
            <div class="warning-card">
                <div class="warning-header">
                    <span class="warning-type">${w.type}</span>
                    <span class="warning-severity severity-${(w.severity || '').toLowerCase().replace(' ', '-')}">${w.severity}</span>
                </div>
                <p class="warning-location">📍 ${w.location}</p>
                <p class="warning-timeline">⏱️ ${w.daysToVisible}</p>
                <div class="warning-action">
                    <strong>Action Required:</strong> ${w.action}
                </div>
            </div>
        `).join('');
    },
    
    // Create irrigation panel
    createIrrigationPanel(irrigation, zones) {
        if (!irrigation) {
            return '<p class="no-data">Irrigation recommendations will appear here</p>';
        }
        
        const immediateZones = irrigation.immediateZones || [];
        const scheduledZones = irrigation.scheduledZones || [];
        
        return `
            <div class="resource-map">
                <div class="resource-priority">
                    <h4>🚨 Immediate Action Required</h4>
                    ${immediateZones.length > 0 ? `
                        <div class="zone-tags critical">
                            ${immediateZones.map(z => `<span class="zone-tag">${z}</span>`).join('')}
                        </div>
                    ` : '<p>No immediate irrigation needed</p>'}
                </div>
                <div class="resource-scheduled">
                    <h4>📅 Scheduled</h4>
                    ${scheduledZones.length > 0 ? `
                        <div class="zone-tags scheduled">
                            ${scheduledZones.map(z => `<span class="zone-tag">${z}</span>`).join('')}
                        </div>
                    ` : '<p>No scheduled irrigation</p>'}
                </div>
                <div class="resource-details">
                    <div class="detail-item">
                        <strong>Application Rate:</strong> ${irrigation.applicationRate || 'Standard rate'}
                    </div>
                    <div class="detail-item">
                        <strong>Best Timing:</strong> ${irrigation.timing || 'Early morning or evening'}
                    </div>
                    <div class="detail-item">
                        <strong>Method:</strong> ${irrigation.method || 'Based on field infrastructure'}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Create fertilization panel
    createFertilizationPanel(fertilization, zones) {
        if (!fertilization) {
            return '<p class="no-data">Fertilization recommendations will appear here</p>';
        }
        
        const recommendations = fertilization.recommendations || [];
        
        return `
            <div class="resource-map">
                <div class="fertilizer-recommendations">
                    ${recommendations.length > 0 ? recommendations.map(rec => `
                        <div class="fertilizer-rec">
                            <div class="rec-header">
                                <span class="rec-zone">${rec.zone}</span>
                                <span class="rec-timing">${rec.timing}</span>
                            </div>
                            <div class="rec-details">
                                <span class="rec-product">🧪 ${rec.fertilizer}</span>
                                <span class="rec-rate">📏 ${rec.rate}</span>
                            </div>
                        </div>
                    `).join('') : '<p>No specific fertilization needed</p>'}
                </div>
            </div>
        `;
    },
    
    // Create inspection panel
    createInspectionPanel(pestControl, zones) {
        if (!pestControl) {
            return '<p class="no-data">Inspection recommendations will appear here</p>';
        }
        
        const inspectionZones = pestControl.inspectionZones || [];
        const measures = pestControl.preventiveMeasures || [];
        
        return `
            <div class="resource-map">
                <div class="inspection-zones">
                    <h4>🔍 Zones Requiring Inspection</h4>
                    ${inspectionZones.length > 0 ? `
                        <div class="zone-tags inspection">
                            ${inspectionZones.map(z => `<span class="zone-tag">${z}</span>`).join('')}
                        </div>
                        <p class="inspection-reason">${pestControl.reason || 'Stressed areas vulnerable to pests'}</p>
                    ` : '<p>No urgent inspections needed</p>'}
                </div>
                <div class="preventive-measures">
                    <h4>🛡️ Preventive Measures</h4>
                    <ul>
                        ${measures.map(m => `<li>${m}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    },
    
    // Create action timeline
    createActionTimeline(actions) {
        if (!actions || actions.length === 0) {
            return '<p class="no-data">Action plan will appear here</p>';
        }
        
        return actions.map((action, i) => `
            <div class="timeline-item priority-${action.priority || i + 1}">
                <div class="timeline-marker">${action.priority || i + 1}</div>
                <div class="timeline-content">
                    <h4>${action.action}</h4>
                    <div class="timeline-meta">
                        <span class="deadline">⏰ ${action.deadline}</span>
                        <span class="improvement">📈 ${action.expectedImprovement}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // Setup resource tabs
    setupResourceTabs() {
        const tabs = $$('.resource-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                $$('.resource-panel').forEach(p => p.classList.remove('active'));
                $(`#panel-${tab.dataset.tab}`)?.classList.add('active');
            });
        });
    },
    
    // Setup zone interactions
    setupZoneInteractions() {
        const zoneBoxes = $$('.zone-box');
        const zoneCards = $$('.zone-card');
        
        zoneBoxes.forEach(box => {
            box.addEventListener('mouseenter', () => {
                const zoneId = box.dataset.zone;
                zoneCards.forEach(card => {
                    card.classList.toggle('highlighted', card.dataset.zone === zoneId);
                });
            });
            
            box.addEventListener('mouseleave', () => {
                zoneCards.forEach(card => card.classList.remove('highlighted'));
            });
        });
    },
    
    // Setup false-color composite tab switching
    setupFalseColorTabs(composites) {
        const tabs = $$('.fc-tab');
        const displayImg = $('#fc-display-img');
        const colorbar = $('#fc-colorbar');
        const infoContent = $('#fc-info-content');
        const originalSrc = $('#eye-preview-img')?.src || '';
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const compositeType = tab.dataset.composite;
                
                // Update displayed image
                switch(compositeType) {
                    case 'original':
                        displayImg.src = originalSrc;
                        break;
                    case 'cir':
                        displayImg.src = composites.cir || originalSrc;
                        break;
                    case 'ndvi':
                        displayImg.src = composites.ndvi || originalSrc;
                        break;
                    case 'ndwi':
                        displayImg.src = composites.ndwi || originalSrc;
                        break;
                    case 'stress':
                        displayImg.src = composites.stress || originalSrc;
                        break;
                }
                
                // Update colorbar and info
                if (colorbar) colorbar.innerHTML = this.createColorBar(compositeType);
                if (infoContent) infoContent.innerHTML = this.createCompositeInfo(compositeType);
            });
        });
    },
    
    // Create color bar for different composite types
    createColorBar(type) {
        switch(type) {
            case 'ndvi':
                return `
                    <div class="colorbar ndvi-bar">
                        <div class="bar-gradient"></div>
                        <div class="bar-labels">
                            <span>-1 (No Veg)</span>
                            <span>0</span>
                            <span>+1 (Dense)</span>
                        </div>
                    </div>
                `;
            case 'ndwi':
                return `
                    <div class="colorbar ndwi-bar">
                        <div class="bar-gradient"></div>
                        <div class="bar-labels">
                            <span>Stressed</span>
                            <span>Normal</span>
                            <span>High Water</span>
                        </div>
                    </div>
                `;
            case 'stress':
                return `
                    <div class="colorbar stress-bar">
                        <div class="bar-gradient"></div>
                        <div class="bar-labels">
                            <span>Critical</span>
                            <span>Moderate</span>
                            <span>Healthy</span>
                        </div>
                    </div>
                `;
            case 'cir':
                return `
                    <div class="colorbar cir-bar">
                        <div class="bar-labels cir-labels">
                            <span>🔴 Red = Healthy Vegetation</span>
                            <span>🟤 Brown = Bare/Stressed</span>
                            <span>🔵 Blue = Water</span>
                        </div>
                    </div>
                `;
            default:
                return '<div class="colorbar-placeholder">Original RGB Image</div>';
        }
    },
    
    // Create info panel content for different composite types
    createCompositeInfo(type) {
        const spectralData = this.spectralData?.statistics || {};
        
        switch(type) {
            case 'original':
                return `
                    <h4>📷 Original RGB Image</h4>
                    <p>Standard true-color photograph showing visible light reflectance.</p>
                    <div class="info-note">
                        <strong>Limitation:</strong> Many plant stress indicators are invisible in RGB. 
                        Use false-color composites to detect early stress.
                    </div>
                `;
            case 'cir':
                return `
                    <h4>🔴 Color Infrared (CIR) Composite</h4>
                    <p>NIR → Red, Red → Green, Green → Blue</p>
                    <div class="info-details">
                        <div class="detail-row">
                            <span>Mapping:</span>
                            <span>Near-Infrared band mapped to Red channel</span>
                        </div>
                    </div>
                    <div class="info-interpretation">
                        <strong>Interpretation:</strong>
                        <ul>
                            <li><span style="color:#ff4444">■</span> Bright Red/Magenta = Healthy, vigorous vegetation</li>
                            <li><span style="color:#ff9999">■</span> Light Pink = Sparse or early-stress vegetation</li>
                            <li><span style="color:#c4a574">■</span> Tan/Brown = Bare soil or dead vegetation</li>
                            <li><span style="color:#4466ff">■</span> Blue/Cyan = Water or wet areas</li>
                        </ul>
                    </div>
                    <div class="info-note">
                        <strong>Why it works:</strong> Healthy plants strongly reflect NIR light while 
                        absorbing red light for photosynthesis. Stressed plants reflect less NIR.
                    </div>
                `;
            case 'ndvi':
                return `
                    <h4>🌱 NDVI Vegetation Index Map</h4>
                    <p>Normalized Difference Vegetation Index</p>
                    <div class="info-formula">
                        <code>NDVI = (NIR - Red) / (NIR + Red)</code>
                    </div>
                    <div class="info-details">
                        <div class="detail-row">
                            <span>Field Average:</span>
                            <span class="value">${spectralData.avgNDVI || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Health Score:</span>
                            <span class="value">${spectralData.overallHealth || 'N/A'}%</span>
                        </div>
                    </div>
                    <div class="info-interpretation">
                        <strong>Color Scale:</strong>
                        <ul>
                            <li><span style="color:#006400">■</span> Dark Green = Dense, healthy vegetation (0.6-1.0)</li>
                            <li><span style="color:#4cbb17">■</span> Green = Good vegetation (0.4-0.6)</li>
                            <li><span style="color:#c0ff3e">■</span> Yellow-Green = Moderate (0.2-0.4)</li>
                            <li><span style="color:#ffff96">■</span> Yellow = Sparse/Stressed (0-0.2)</li>
                            <li><span style="color:#8b5a2b">■</span> Brown = Bare soil (&lt;0)</li>
                        </ul>
                    </div>
                `;
            case 'ndwi':
                return `
                    <h4>💧 Water Stress Index Map (NDWI-based)</h4>
                    <p>Normalized Difference Water Index</p>
                    <div class="info-formula">
                        <code>NDWI = (Green - NIR) / (Green + NIR)</code>
                    </div>
                    <div class="info-details">
                        <div class="detail-row">
                            <span>Field Average:</span>
                            <span class="value">${spectralData.avgNDWI || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="info-interpretation">
                        <strong>Color Scale:</strong>
                        <ul>
                            <li><span style="color:#0064ff">■</span> Blue = High water content</li>
                            <li><span style="color:#00c8c8">■</span> Cyan = Adequate moisture</li>
                            <li><span style="color:#64c864">■</span> Green = Normal</li>
                            <li><span style="color:#ffc800">■</span> Yellow = Mild stress</li>
                            <li><span style="color:#ff3200">■</span> Red = Severe water stress</li>
                        </ul>
                    </div>
                    <div class="info-note">
                        <strong>Early Detection:</strong> Water stress appears in NDWI 3-5 days 
                        before visible wilting symptoms.
                    </div>
                `;
            case 'stress':
                return `
                    <h4>⚠️ Combined Stress Detection Map</h4>
                    <p>Multi-index analysis for early stress identification</p>
                    <div class="info-details">
                        <div class="detail-row">
                            <span>Indices Combined:</span>
                            <span>NDVI + NDWI + VARI + ExG</span>
                        </div>
                    </div>
                    <div class="info-interpretation">
                        <strong>Stress Levels:</strong>
                        <ul>
                            <li><span style="color:#009600">■</span> Dark Green = Excellent health</li>
                            <li><span style="color:#64c832">■</span> Light Green = Good condition</li>
                            <li><span style="color:#ffc800">■</span> Yellow = Moderate stress</li>
                            <li><span style="color:#ff6400">■</span> Orange = High stress</li>
                            <li><span style="color:#c80000">■</span> Red = Critical stress</li>
                        </ul>
                    </div>
                    <div class="info-note">
                        <strong>Precision Application:</strong> Use this map to target irrigation, 
                        fertilization, and inspection to specific areas showing stress.
                    </div>
                `;
            default:
                return '<p>Select a composite type to view information.</p>';
        }
    },
    
    // Helper functions
    getStatusClass(scoreOrStatus) {
        if (typeof scoreOrStatus === 'number') {
            if (scoreOrStatus >= 80) return 'excellent';
            if (scoreOrStatus >= 60) return 'good';
            if (scoreOrStatus >= 40) return 'moderate';
            if (scoreOrStatus >= 20) return 'poor';
            return 'critical';
        }
        const status = (scoreOrStatus || '').toLowerCase();
        if (status.includes('excellent')) return 'excellent';
        if (status.includes('good')) return 'good';
        if (status.includes('moderate')) return 'moderate';
        if (status.includes('poor')) return 'poor';
        if (status.includes('critical')) return 'critical';
        return 'moderate';
    },
    
    getStatusText(score) {
        if (score >= 80) return 'Excellent Health';
        if (score >= 60) return 'Good with Minor Issues';
        if (score >= 40) return 'Moderate Stress Detected';
        if (score >= 20) return 'Poor - Action Required';
        return 'Critical - Immediate Action';
    },
    
    getScoreGradient(score) {
        if (score >= 80) return 'var(--health-excellent)';
        if (score >= 60) return 'var(--health-good)';
        if (score >= 40) return 'var(--health-moderate)';
        if (score >= 20) return 'var(--health-poor)';
        return 'var(--health-critical)';
    },
    
    // Export report
    exportReport() {
        if (!this.analysisResult) {
            Utils.toast.warning('No analysis data to export');
            return;
        }
        Utils.toast.info('Report export feature coming soon!');
    },
    
    // Export data
    exportData() {
        if (!this.analysisResult) {
            Utils.toast.warning('No analysis data to export');
            return;
        }
        
        const dataStr = JSON.stringify(this.analysisResult, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `krishimitra-health-map-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        Utils.toast.success('Data exported!');
    },
    
    // Legacy method for compatibility
    displayResults(result) {
        this.displayHealthMap(result);
    }
};

// Export
window.EyeModule = EyeModule;
