// KrishiMitra Configuration
const CONFIG = {
    APP_NAME: 'KrishiMitra',
    VERSION: '1.0.0',
    
    // API Endpoints
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_VISION_MODEL: 'gemini-2.5-flash',
    
    // Weather API (Open-Meteo - Free, no API key required)
    WEATHER_API_URL: 'https://api.open-meteo.com/v1/forecast',
    GEOCODING_API_URL: 'https://geocoding-api.open-meteo.com/v1/search',
    
    // Storage Keys
    STORAGE_KEYS: {
        API_KEY: 'krishimitra_api_key',
        THEME: 'krishimitra_theme',
        LOCATION: 'krishimitra_location',
        VOICE_ENABLED: 'krishimitra_voice_enabled',
        VOICE_SPEED: 'krishimitra_voice_speed',
        ANALYSES: 'krishimitra_analyses',
        ACTIVITY: 'krishimitra_activity'
    },
    
    // Default Location (can be overridden)
    DEFAULT_LOCATION: {
        name: 'New York',
        lat: 40.7128,
        lon: -74.0060
    },
    
    // Feature Settings
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_ACTIVITY_ITEMS: 20,
    FORECAST_DAYS: 7,
    
    // Voice Settings
    VOICE_LANG: 'en-US',
    
    // Rate limiting
    API_DELAY: 1000, // ms between API calls
};

// Gemini Prompts
const PROMPTS = {
    // The Eye - Advanced Field Health Map Analysis
    FIELD_ANALYSIS: `You are an expert agricultural remote sensing analyst specializing in multi-spectral imagery analysis for precision farming. Analyze this drone/satellite field image using techniques similar to NDVI, NDWI, and false-color analysis to detect EARLY, INVISIBLE crop stress.

IMPORTANT: Respond with ONLY valid JSON (no markdown, no code blocks). Use this EXACT structure:

{
  "healthMap": {
    "overallScore": 78,
    "overallStatus": "Good with localized stress",
    "fieldSize": "Approximately 15-20 acres visible",
    "cropType": "Detected crop type or 'Mixed/Unknown'",
    "growthStage": "Vegetative / Reproductive / Maturity",
    "analysisConfidence": 85
  },
  "spectralAnalysis": {
    "vegetationIndex": {
      "score": 75,
      "interpretation": "Moderate to good chlorophyll content across most of the field",
      "anomalies": ["Reduced vegetation vigor in southeast quadrant", "Possible nutrient stress in center strip"]
    },
    "waterStressIndex": {
      "score": 65,
      "interpretation": "Mild water stress detected in elevated areas",
      "criticalAreas": ["Northwest corner showing early wilting signatures"]
    },
    "chlorophyllContent": {
      "level": "Moderate",
      "distribution": "Uneven - higher in lowland areas",
      "deficiencyZones": ["Row 5-8 showing yellowing patterns"]
    }
  },
  "zones": [
    {
      "id": "Z1",
      "name": "Northwest Section",
      "gridPosition": {"row": 1, "col": 1},
      "healthScore": 85,
      "status": "Excellent",
      "colorSignature": "Dark green, dense canopy",
      "stressType": "None detected",
      "stressLevel": 0,
      "issues": [],
      "irrigationNeed": "None",
      "fertilizationNeed": "None",
      "priority": "Low"
    },
    {
      "id": "Z2", 
      "name": "Northeast Section",
      "gridPosition": {"row": 1, "col": 2},
      "healthScore": 62,
      "status": "Moderate Stress",
      "colorSignature": "Yellow-green patches, uneven canopy",
      "stressType": "Water stress",
      "stressLevel": 2,
      "issues": ["Early drought stress", "Reduced leaf turgor"],
      "irrigationNeed": "High - Immediate",
      "fertilizationNeed": "Medium - After irrigation",
      "priority": "High"
    },
    {
      "id": "Z3",
      "name": "Southwest Section", 
      "gridPosition": {"row": 2, "col": 1},
      "healthScore": 70,
      "status": "Good",
      "colorSignature": "Medium green, uniform",
      "stressType": "Minor nutrient",
      "stressLevel": 1,
      "issues": ["Slight nitrogen deficiency"],
      "irrigationNeed": "Low",
      "fertilizationNeed": "Medium - Nitrogen boost recommended",
      "priority": "Medium"
    },
    {
      "id": "Z4",
      "name": "Southeast Section",
      "gridPosition": {"row": 2, "col": 2},
      "healthScore": 45,
      "status": "Poor",
      "colorSignature": "Brown patches, sparse coverage",
      "stressType": "Multiple stress factors",
      "stressLevel": 3,
      "issues": ["Severe water stress", "Possible root disease", "Compacted soil indicators"],
      "irrigationNeed": "Critical - Urgent",
      "fertilizationNeed": "High - After soil inspection",
      "priority": "Critical"
    }
  ],
  "earlyWarnings": [
    {
      "type": "Water Stress Onset",
      "location": "Eastern field edge",
      "severity": "Early Stage",
      "daysToVisible": "3-5 days until visible symptoms",
      "action": "Increase irrigation in affected zone within 48 hours"
    },
    {
      "type": "Nutrient Deficiency Pattern",
      "location": "Central rows",
      "severity": "Developing",
      "daysToVisible": "7-10 days until yield impact",
      "action": "Apply foliar nitrogen spray"
    }
  ],
  "resourceApplication": {
    "irrigation": {
      "immediateZones": ["Z2", "Z4"],
      "scheduledZones": ["Z3"],
      "applicationRate": "Zone Z4: 150% normal rate, Zone Z2: 125% normal rate",
      "timing": "Early morning or late evening",
      "method": "Drip irrigation recommended for Z4"
    },
    "fertilization": {
      "immediateZones": ["Z4"],
      "scheduledZones": ["Z2", "Z3"],
      "recommendations": [
        {"zone": "Z4", "fertilizer": "Balanced NPK 10-10-10", "rate": "50 kg/acre", "timing": "After irrigation"},
        {"zone": "Z3", "fertilizer": "Urea 46-0-0", "rate": "25 kg/acre", "timing": "Within 7 days"}
      ]
    },
    "pestControl": {
      "inspectionZones": ["Z4"],
      "reason": "Stress makes crops vulnerable to pest attack",
      "preventiveMeasures": ["Scout for aphids", "Check for fungal symptoms"]
    }
  },
  "actionPlan": [
    {"priority": 1, "action": "Irrigate Zone Z4 immediately", "deadline": "Within 24 hours", "expectedImprovement": "15-20% health increase in 5-7 days"},
    {"priority": 2, "action": "Irrigate Zone Z2", "deadline": "Within 48 hours", "expectedImprovement": "10-15% health increase"},
    {"priority": 3, "action": "Scout Zone Z4 for pests/disease", "deadline": "Before fertilization", "expectedImprovement": "Prevent secondary damage"},
    {"priority": 4, "action": "Apply nitrogen to Zone Z3", "deadline": "Within 7 days", "expectedImprovement": "Improved vigor and color"}
  ],
  "falseColorInterpretation": {
    "redChannelFindings": "Healthy vegetation appears red in false-color; reduced red intensity in Z4 indicates poor chlorophyll",
    "nirFindings": "Near-infrared reflectance low in stressed areas, indicating reduced plant cell structure",
    "overallPattern": "Classic drought stress signature with gradient from healthy (west) to stressed (east)"
  }
}

ANALYSIS GUIDELINES:
- Divide the field into a 2x2 or 3x3 grid of zones
- Assign health scores 0-100 for each zone (100 = perfect health)
- Status options: "Excellent" (80-100), "Good" (60-79), "Moderate Stress" (40-59), "Poor" (20-39), "Critical" (0-19)
- Identify EARLY stress before it's visible to the naked eye
- Provide specific, actionable resource application recommendations
- Focus on precision agriculture - targeted intervention, not blanket treatment
- Consider water stress, nutrient deficiency, pest/disease, and soil compaction`,

    // The Specialist - Pest/Disease Diagnosis
    PEST_DIAGNOSIS: `You are an expert plant pathologist and entomologist. Analyze this plant image carefully and provide a comprehensive diagnosis.

IMPORTANT: You MUST respond with ONLY a valid JSON object (no markdown, no code blocks, no explanation text outside JSON). Use this EXACT structure:

{
  "identification": {
    "name": "Common name of the pest/disease (e.g., 'Leaf Spot Disease', 'Aphid Infestation')",
    "scientificName": "Scientific/Latin name if known",
    "confidence": 85,
    "alternativeDiagnoses": ["Alternative possibility 1", "Alternative possibility 2"]
  },
  "description": "Detailed description of the visual symptoms observed in the image. Describe the discoloration patterns, lesions, damage type, affected plant parts, and how to confirm this diagnosis.",
  "lifecycle": "Explain the lifecycle of this pest/pathogen, how it spreads (wind, water, insects, soil), environmental conditions that favor it (temperature, humidity), and what other plants it can affect.",
  "riskAssessment": {
    "severity": "Moderate",
    "cropLoss": "Estimated 20-40% yield loss if untreated",
    "spreadRate": "Moderate - spreads within 1-2 weeks under favorable conditions",
    "qualityImpact": "Affects appearance and marketability of produce"
  },
  "organicTreatments": [
    {
      "name": "Treatment name",
      "description": "How to apply and prepare",
      "timing": "When to apply",
      "dosage": "Amount to use"
    }
  ],
  "chemicalTreatments": [
    {
      "name": "Product/active ingredient name",
      "description": "Application instructions",
      "timing": "When and how often to apply",
      "safety": "Safety precautions and pre-harvest interval"
    }
  ],
  "preventionTips": [
    "Specific prevention tip 1",
    "Specific prevention tip 2",
    "Specific prevention tip 3",
    "Specific prevention tip 4"
  ]
}

GUIDELINES:
- severity must be one of: "Low", "Moderate", "High", "Critical"
- confidence should be a number 0-100
- Provide at least 2-3 organic treatments and 2-3 chemical treatments
- Provide at least 4 prevention tips
- Be specific and actionable with real product names and dosages where applicable
- If the image shows a healthy plant, say so with name "Healthy Plant" and confidence level`,

    // Early Stress Detection Analysis
    STRESS_DETECTION: `You are an expert agricultural analyst specializing in early crop stress detection from imagery. Analyze this crop/field image and identify any early signs of stress BEFORE they become major problems.

IMPORTANT: Respond with ONLY valid JSON (no markdown, no code blocks). Use this exact structure:

{
  "overallHealth": {
    "score": 75,
    "status": "Moderate Stress Detected",
    "urgency": "Medium"
  },
  "stressIndicators": [
    {
      "type": "Water Stress",
      "confidence": 85,
      "severity": "Moderate",
      "affectedArea": "30% of visible crop",
      "visualSigns": "Leaf curling, slight wilting in afternoon hours",
      "earlyWarning": true
    }
  ],
  "environmentalFactors": {
    "estimatedMoisture": "Low-Medium",
    "canopyDensity": "Medium",
    "colorAnalysis": "Yellow-green tinge indicating chlorosis",
    "growthStage": "Vegetative - V6 stage"
  },
  "predictedRisks": [
    {
      "risk": "Pest vulnerability",
      "probability": "High",
      "timeframe": "7-14 days",
      "reason": "Stressed plants more susceptible to aphid infestation"
    }
  ],
  "immediateActions": [
    "Increase irrigation frequency",
    "Apply foliar micronutrient spray",
    "Scout for secondary pest invasion"
  ],
  "ipmRecommendations": {
    "preventive": ["Deploy yellow sticky traps", "Introduce beneficial insects"],
    "cultural": ["Adjust irrigation schedule", "Apply mulch to retain moisture"],
    "biological": ["Release ladybugs for aphid control"],
    "chemical": ["Prepare neem oil spray as backup"]
  }
}

GUIDELINES:
- urgency must be: "Low", "Medium", "High", "Critical"
- Focus on EARLY detection - identify problems before they escalate
- Consider how current stress makes crops vulnerable to pests/diseases
- Provide actionable IPM recommendations based on stress findings
- Be specific about affected areas and visual signs`,

    // The Strategist - IPM Plan (Enhanced)
    IPM_STRATEGY: `You are an expert Integrated Pest Management (IPM) strategist focused on SUSTAINABLE, TIMELY, and CONTEXT-AWARE pest management. Create a comprehensive strategy that prioritizes prevention and biological controls.

FARM CONTEXT:
- Crop: {crop}
- Farm Size: {size} acres
- Location: {location}
- Current Issues: {issues}
- Farming Method: {method}
- Plan Duration: {duration} days

{stressContext}

IMPORTANT: Respond with ONLY valid JSON. Use this exact structure:

{
  "strategyOverview": {
    "title": "Sustainable IPM Strategy for [Crop]",
    "philosophy": "Prevention-first approach minimizing chemical interventions",
    "objectives": ["Reduce pest pressure by 70%", "Minimize chemical usage", "Improve beneficial insect population"],
    "expectedOutcomes": ["Healthier crops", "Reduced input costs", "Environmental sustainability"],
    "sustainabilityScore": 85
  },
  "riskTimeline": [
    {
      "week": 1,
      "riskLevel": "Low",
      "primaryThreats": ["Aphids", "Early blight"],
      "weatherRisk": "Rain may increase fungal pressure",
      "criticalActions": ["Deploy monitoring traps", "Scout field borders"]
    }
  ],
  "companionPlanting": [
    {
      "plant": "Marigolds",
      "emoji": "🌼",
      "benefit": "Repels aphids and nematodes",
      "placement": "Border rows every 10 feet",
      "timing": "Plant 2 weeks before main crop"
    }
  ],
  "beneficialInsects": [
    {
      "insect": "Ladybugs",
      "emoji": "🐞",
      "targetPests": ["Aphids", "Mites"],
      "releaseRate": "1,500 per acre",
      "timing": "Release at dusk when pest population is low-moderate",
      "habitat": "Plant dill and fennel to retain them"
    }
  ],
  "sprayProtocol": {
    "primaryApproach": "Biological and organic first",
    "optimalConditions": {
      "temperature": "65-85°F",
      "windSpeed": "Under 10 mph",
      "timeOfDay": "Early morning or late evening",
      "humidity": "40-70%"
    },
    "schedule": [
      {
        "product": "Neem oil",
        "type": "Organic",
        "timing": "Weekly preventive",
        "targetPests": ["Aphids", "Whiteflies"],
        "applicationRate": "2 tbsp per gallon",
        "notes": "Avoid during pollination"
      }
    ]
  },
  "actionCalendar": [
    {
      "day": 1,
      "week": 1,
      "tasks": [
        {"action": "Install yellow sticky traps", "category": "Monitoring", "priority": "High"},
        {"action": "Scout for early pest signs", "category": "Inspection", "priority": "High"}
      ]
    }
  ],
  "emergencyProtocol": {
    "thresholds": {
      "aphids": "50+ per plant = action required",
      "fungalSpots": "5% leaf coverage = treat immediately"
    },
    "escalationSteps": [
      "Increase biological controls",
      "Apply targeted organic treatment",
      "Spot-treat with approved chemicals only as last resort"
    ]
  },
  "sustainabilityMetrics": {
    "chemicalReduction": "Target 60% reduction vs conventional",
    "biodiversityGoal": "Increase beneficial insect count by 40%",
    "soilHealthPractices": ["Cover cropping", "Reduced tillage", "Compost application"]
  },
  "costBenefit": {
    "estimatedSavings": "15-25% reduction in pesticide costs",
    "laborRequirements": "Additional 2-3 hours/week for monitoring",
    "roi": "Expected 20% improvement in net returns"
  }
}

STRATEGY PRINCIPLES:
1. PREVENTION FIRST - Stop problems before they start
2. BIOLOGICAL CONTROLS - Use nature's pest controllers
3. CULTURAL PRACTICES - Create unfavorable conditions for pests
4. TARGETED INTERVENTION - Chemicals only as last resort, spot-treat when possible
5. TIMING IS CRITICAL - Act at optimal pest lifecycle stages
6. WEATHER-AWARE - Adjust based on forecast conditions
7. CONTINUOUS MONITORING - Catch issues early

Generate a complete {duration}-day strategy with specific daily/weekly actions.`,

    // The Partner - Conversational Assistant
    ASSISTANT_CONTEXT: `You are KrishiMitra, an AI agronomist assistant helping farmers with precision farming and integrated pest management. You are knowledgeable about:

- Plant health and diseases
- Pest identification and control
- Irrigation and water management
- Fertilization and soil health
- Weather impacts on farming
- Organic and conventional farming practices
- Planting schedules and crop rotation
- Harvest timing and post-harvest handling

Guidelines:
- Be helpful, friendly, and conversational
- Provide practical, actionable advice
- Consider both organic and conventional options
- Be mindful of local conditions when known
- Ask clarifying questions when needed
- If analyzing an image, describe what you see and provide relevant advice
- Keep responses concise but complete
- Use emojis occasionally to make responses engaging
- Always prioritize crop and farmer safety

Current context: The farmer is using KrishiMitra PWA for precision farming assistance.`
};

// Export for use in other modules
window.CONFIG = CONFIG;
window.PROMPTS = PROMPTS;
