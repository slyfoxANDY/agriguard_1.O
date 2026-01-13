// Weather API Integration for KrishiMitra

const WeatherAPI = {
    location: null,
    cache: {},
    cacheExpiry: 30 * 60 * 1000, // 30 minutes
    
    // Initialize with location
    init() {
        const savedLocation = Utils.storage.get(CONFIG.STORAGE_KEYS.LOCATION);
        if (savedLocation) {
            this.location = savedLocation;
        } else {
            this.location = CONFIG.DEFAULT_LOCATION;
        }
    },
    
    // Set location
    setLocation(location) {
        this.location = location;
        Utils.storage.set(CONFIG.STORAGE_KEYS.LOCATION, location);
        this.clearCache();
    },
    
    // Get location
    getLocation() {
        return this.location;
    },
    
    // Clear cache
    clearCache() {
        this.cache = {};
    },
    
    // Search for location
    async searchLocation(query) {
        try {
            const url = `${CONFIG.GEOCODING_API_URL}?name=${encodeURIComponent(query)}&count=5`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Location search failed');
            }
            
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                return [];
            }
            
            return data.results.map(r => ({
                name: `${r.name}, ${r.admin1 || ''}, ${r.country}`.replace(/, ,/g, ','),
                lat: r.latitude,
                lon: r.longitude,
                country: r.country
            }));
        } catch (error) {
            console.error('Location search error:', error);
            throw error;
        }
    },
    
    // Detect user location
    async detectLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // Reverse geocode to get location name
                    try {
                        const url = `${CONFIG.GEOCODING_API_URL}?latitude=${latitude}&longitude=${longitude}&count=1`;
                        const response = await fetch(url);
                        const data = await response.json();
                        
                        if (data.results && data.results.length > 0) {
                            const r = data.results[0];
                            const location = {
                                name: `${r.name}, ${r.country}`,
                                lat: latitude,
                                lon: longitude
                            };
                            this.setLocation(location);
                            resolve(location);
                        } else {
                            const location = {
                                name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
                                lat: latitude,
                                lon: longitude
                            };
                            this.setLocation(location);
                            resolve(location);
                        }
                    } catch (e) {
                        const location = {
                            name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
                            lat: latitude,
                            lon: longitude
                        };
                        this.setLocation(location);
                        resolve(location);
                    }
                },
                (error) => {
                    reject(new Error('Location access denied'));
                }
            );
        });
    },
    
    // Get current weather
    async getCurrentWeather() {
        const cacheKey = `current_${this.location.lat}_${this.location.lon}`;
        
        // Check cache
        if (this.cache[cacheKey] && Date.now() - this.cache[cacheKey].timestamp < this.cacheExpiry) {
            return this.cache[cacheKey].data;
        }
        
        try {
            const url = `${CONFIG.WEATHER_API_URL}?latitude=${this.location.lat}&longitude=${this.location.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Weather fetch failed');
            }
            
            const data = await response.json();
            
            const isDay = data.current.is_day === 1;
            
            const weather = {
                temperature: Math.round(data.current.temperature_2m),
                humidity: data.current.relative_humidity_2m,
                windSpeed: Math.round(data.current.wind_speed_10m),
                weatherCode: data.current.weather_code,
                isDay: isDay,
                emoji: Utils.getWeatherEmoji(data.current.weather_code, isDay),
                description: this.getWeatherDescription(data.current.weather_code),
                location: this.location.name
            };
            
            // Cache the result
            this.cache[cacheKey] = {
                data: weather,
                timestamp: Date.now()
            };
            
            return weather;
        } catch (error) {
            console.error('Weather error:', error);
            throw error;
        }
    },
    
    // Get forecast
    async getForecast(days = CONFIG.FORECAST_DAYS) {
        const cacheKey = `forecast_${this.location.lat}_${this.location.lon}_${days}`;
        
        // Check cache
        if (this.cache[cacheKey] && Date.now() - this.cache[cacheKey].timestamp < this.cacheExpiry) {
            return this.cache[cacheKey].data;
        }
        
        try {
            const url = `${CONFIG.WEATHER_API_URL}?latitude=${this.location.lat}&longitude=${this.location.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max&forecast_days=${days}&timezone=auto`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Forecast fetch failed');
            }
            
            const data = await response.json();
            
            const forecast = data.daily.time.map((date, i) => ({
                date: date,
                dayName: Utils.date.getDayName(date),
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
                weatherCode: data.daily.weather_code[i],
                emoji: Utils.getWeatherEmoji(data.daily.weather_code[i]),
                precipProbability: data.daily.precipitation_probability_max[i],
                windSpeed: Math.round(data.daily.wind_speed_10m_max[i])
            }));
            
            // Cache the result
            this.cache[cacheKey] = {
                data: forecast,
                timestamp: Date.now()
            };
            
            return forecast;
        } catch (error) {
            console.error('Forecast error:', error);
            throw error;
        }
    },
    
    // Get hourly data for spray timing
    async getHourlyForecast(days = 3) {
        try {
            const url = `${CONFIG.WEATHER_API_URL}?latitude=${this.location.lat}&longitude=${this.location.lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability&forecast_days=${days}&timezone=auto`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Hourly forecast fetch failed');
            }
            
            const data = await response.json();
            
            return data.hourly.time.map((time, i) => ({
                time: time,
                temperature: data.hourly.temperature_2m[i],
                humidity: data.hourly.relative_humidity_2m[i],
                windSpeed: data.hourly.wind_speed_10m[i],
                precipProbability: data.hourly.precipitation_probability[i]
            }));
        } catch (error) {
            console.error('Hourly forecast error:', error);
            throw error;
        }
    },
    
    // Find optimal spray windows
    async findSprayWindows() {
        try {
            const hourly = await this.getHourlyForecast(3);
            const windows = [];
            
            hourly.forEach((hour, i) => {
                // Optimal conditions: low wind (<10 km/h), no rain (<20% prob), moderate temp (15-25°C)
                const isOptimal = 
                    hour.windSpeed < 10 &&
                    hour.precipProbability < 20 &&
                    hour.temperature >= 15 &&
                    hour.temperature <= 30;
                
                if (isOptimal) {
                    const date = new Date(hour.time);
                    const hourOfDay = date.getHours();
                    
                    // Prefer early morning (6-9) or late afternoon (17-19)
                    const isPrimeTime = (hourOfDay >= 6 && hourOfDay <= 9) || (hourOfDay >= 17 && hourOfDay <= 19);
                    
                    windows.push({
                        time: hour.time,
                        date: Utils.date.format(hour.time, 'medium'),
                        hour: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        conditions: {
                            temperature: hour.temperature,
                            humidity: hour.humidity,
                            windSpeed: hour.windSpeed,
                            precipProbability: hour.precipProbability
                        },
                        isPrimeTime,
                        score: isPrimeTime ? 100 : 80
                    });
                }
            });
            
            // Sort by score and limit
            return windows
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
        } catch (error) {
            console.error('Spray window error:', error);
            throw error;
        }
    },
    
    // Get weather description from code
    getWeatherDescription(code) {
        const descriptions = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            80: 'Slight showers',
            81: 'Moderate showers',
            82: 'Violent showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with hail',
            99: 'Severe thunderstorm'
        };
        return descriptions[code] || 'Unknown';
    },
    
    // Get farming advisory based on weather
    async getFarmingAdvisory() {
        try {
            const current = await this.getCurrentWeather();
            const forecast = await this.getForecast(3);
            
            const advisories = [];
            
            // Temperature advisory
            if (current.temperature > 35) {
                advisories.push({
                    type: 'warning',
                    title: 'Heat Stress Warning',
                    message: 'High temperatures may stress crops. Consider additional irrigation and avoid midday fieldwork.',
                    icon: '🌡️'
                });
            } else if (current.temperature < 10) {
                advisories.push({
                    type: 'warning',
                    title: 'Cold Weather Alert',
                    message: 'Low temperatures detected. Protect sensitive crops from frost.',
                    icon: '❄️'
                });
            }
            
            // Wind advisory
            if (current.windSpeed > 20) {
                advisories.push({
                    type: 'warning',
                    title: 'High Wind Advisory',
                    message: 'Not recommended for spraying. Wind may cause drift and reduce effectiveness.',
                    icon: '💨'
                });
            }
            
            // Rain in forecast
            const rainyDays = forecast.filter(d => d.precipProbability > 60);
            if (rainyDays.length > 0) {
                advisories.push({
                    type: 'info',
                    title: 'Rain Expected',
                    message: `Rain likely on ${rainyDays.map(d => d.dayName).join(', ')}. Plan irrigation and spraying accordingly.`,
                    icon: '🌧️'
                });
            }
            
            // Good conditions
            if (advisories.length === 0) {
                advisories.push({
                    type: 'success',
                    title: 'Favorable Conditions',
                    message: 'Weather conditions are good for farming activities.',
                    icon: '✅'
                });
            }
            
            return advisories;
        } catch (error) {
            console.error('Advisory error:', error);
            return [{
                type: 'error',
                title: 'Weather Unavailable',
                message: 'Unable to fetch weather data. Check your connection.',
                icon: '⚠️'
            }];
        }
    }
};

// Export
window.WeatherAPI = WeatherAPI;
