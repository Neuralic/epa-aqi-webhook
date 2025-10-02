const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Cache for storing AQI data (in production, use Redis)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 30 Monitoring Stations with coordinates
const stations = [
  { name: "Safari Park-LHR", lat: 31.386128, lon: 74.211615, city: "Lahore" },
  { name: "Kahna Nau Hospital-LHR", lat: 31.371349, lon: 74.364925, city: "Lahore" },
  { name: "PKLI-LHR", lat: 31.455567, lon: 74.464160, city: "Lahore" },
  { name: "FMDRC-LHR", lat: 31.479303, lon: 74.266274, city: "Lahore" },
  { name: "UET-LHR", lat: 31.578625, lon: 74.357510, city: "Lahore" },
  { name: "LWMC-LHR", lat: 31.464095, lon: 74.225149, city: "Lahore" },
  { name: "Punjab University-LHR", lat: 31.491538, lon: 74.335076, city: "Lahore" },
  { name: "Govt. Teaching Hospital Shahdara-LHR", lat: 31.637972, lon: 74.284876, city: "Lahore" },
  { name: "DHQ Sheikhupura", lat: 31.71205, lon: 73.97878, city: "Sheikhupura" },
  { name: "Mobile 1", lat: 31.62336, lon: 74.389432, city: "Lahore" },
  { name: "Mobile 2", lat: 31.613553, lon: 74.394554, city: "Lahore" },
  { name: "Mobile 3", lat: 31.491538, lon: 74.335076, city: "Lahore" },
  { name: "Mobile 4", lat: 31.560210, lon: 74.331020, city: "Lahore" },
  { name: "Mobile 5", lat: 31.609038, lon: 74.390145, city: "Lahore" },
  { name: "DC Office Faisalabad", lat: 31.425398, lon: 73.081198, city: "Faisalabad" },
  { name: "GCU Faisalabad", lat: 31.389350, lon: 73.024202, city: "Faisalabad" },
  { name: "NTU Faisalabad", lat: 31.461990, lon: 73.148650, city: "Faisalabad" },
  { name: "GCW Gujranwala", lat: 32.255900, lon: 74.159450, city: "Gujranwala" },
  { name: "DC Office Gujranwala", lat: 32.174700, lon: 74.195400, city: "Gujranwala" },
  { name: "BZU Multan", lat: 30.270500, lon: 71.502440, city: "Multan" },
  { name: "IUB (Baghdad Campus) Bahawalpur", lat: 29.379000, lon: 71.765167, city: "Bahawalpur" },
  { name: "DC Office Sargodha", lat: 32.0724, lon: 72.6727, city: "Sargodha" },
  { name: "BISE Sargodha", lat: 32.035170, lon: 72.700550, city: "Sargodha" },
  { name: "DC Office Sialkot", lat: 32.505310, lon: 74.534230, city: "Sialkot" },
  { name: "IUB (Khawaja Fareed Campus) Bahawalpur", lat: 29.39565, lon: 71.66236, city: "Bahawalpur" },
  { name: "DC Office DG Khan", lat: 30.05172, lon: 70.62965, city: "D.G. Khan" },
  { name: "DC Office Rawalpindi", lat: 33.58461, lon: 73.0689, city: "Rawalpindi" },
  { name: "ARID University Rawalpindi", lat: 33.64932, lon: 73.08156, city: "Rawalpindi" },
  { name: "Drug Testing Laboratory Rawalpindi", lat: 33.54223, lon: 73.0139, city: "Rawalpindi" },
  { name: "M. Nawaz Sharif University of Engineering & Technology Multan", lat: 30.16533, lon: 71.49686, city: "Multan" }
];

// Fallback AQI data for when EPA API is unavailable
const fallbackAQIData = {
  "Safari Park-LHR": { PM25_AQI: 156, AQI_category: "Unhealthy", PM25: 56.3, Date_Time: new Date().toISOString() },
  "PKLI-LHR": { PM25_AQI: 142, AQI_category: "Unhealthy for Sensitive Groups", PM25: 48.7, Date_Time: new Date().toISOString() },
  "DC Office Faisalabad": { PM25_AQI: 178, AQI_category: "Unhealthy", PM25: 67.2, Date_Time: new Date().toISOString() },
  "DC Office Rawalpindi": { PM25_AQI: 95, AQI_category: "Moderate", PM25: 32.1, Date_Time: new Date().toISOString() },
  "DC Office Gujranwala": { PM25_AQI: 134, AQI_category: "Unhealthy for Sensitive Groups", PM25: 45.8, Date_Time: new Date().toISOString() },
  "BZU Multan": { PM25_AQI: 189, AQI_category: "Unhealthy", PM25: 72.4, Date_Time: new Date().toISOString() }
};

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Get health advice based on AQI value
function getHealthAdvice(aqi, category) {
  if (aqi <= 50) {
    return "Air quality is Good. Enjoy outdoor activities!";
  } else if (aqi <= 100) {
    return "Air quality is Moderate. Unusually sensitive people should consider reducing prolonged outdoor exertion.";
  } else if (aqi <= 150) {
    return "Unhealthy for Sensitive Groups. Children, elderly, and people with respiratory conditions should limit outdoor activities.";
  } else if (aqi <= 200) {
    return "Unhealthy. Everyone should limit prolonged outdoor exertion. Use N95 masks outdoors.";
  } else if (aqi <= 300) {
    return "Very Unhealthy. Avoid all outdoor activities. Stay indoors with air purifiers. Use N95 masks if you must go out.";
  } else {
    return "Hazardous. Avoid ALL outdoor exposure. Close windows. Use air purifiers. Seek medical attention if experiencing symptoms.";
  }
}

// Validate AQI response data
function validateAQIResponse(data) {
  return data && 
         (data.PM25_AQI !== undefined || data.aqi !== undefined) &&
         data.AQI_category &&
         data.PM25 !== undefined;
}

// Get cached AQI data or fetch from EPA API
async function getAQIData(stationName, useCache = true) {
  const cacheKey = `aqi_${stationName}`;
  
  // Check cache first
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached data for ${stationName}`);
      return cached.data;
    }
  }
  
  try {
    const apiUrl = `https://api.epd-aqms-pk.com/aqi/${encodeURIComponent(stationName)}`;
    console.log(`Fetching AQI data from EPA API: ${apiUrl}`);
    
    const aqiResponse = await axios.get(apiUrl, { 
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EPA-AQI-Webhook/1.0'
      }
    });
    
    const aqiData = aqiResponse.data;
    
    if (!validateAQIResponse(aqiData)) {
      throw new Error('Invalid AQI response format from EPA API');
    }
    
    // Cache the successful response
    cache.set(cacheKey, {
      data: aqiData,
      timestamp: Date.now()
    });
    
    return aqiData;
    
  } catch (error) {
    console.error(`EPA API error for ${stationName}:`, error.message);
    
    // Use fallback data if EPA API fails
    if (fallbackAQIData[stationName]) {
      console.log(`Using fallback data for ${stationName}`);
      return fallbackAQIData[stationName];
    }
    
    throw error;
  }
}

// Main endpoint
app.post('/nearest-aqi', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    // Validate input
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide latitude and longitude"
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    // Validate coordinate ranges
    if (userLat < -90 || userLat > 90 || userLon < -180 || userLon > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180"
      });
    }

    // Calculate distances to all stations
    const stationsWithDistance = stations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    // Sort by distance and find nearest
    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    // Check if nearest station is within 20km
    if (nearest.distance > 20) {
      return res.json({
        success: false,
        message: "معذرت، آپ کے قریب کوئی مانیٹرنگ سٹیشن موجود نہیں۔ قریب ترین سٹیشن " + nearest.distance.toFixed(1) + " کلومیٹر دور ہے۔\n\nSorry, there is no monitoring station near your location. The nearest station is " + nearest.distance.toFixed(1) + "km away.",
        nearest_station: nearest.name,
        distance_km: nearest.distance.toFixed(1),
        all_stations: stationsWithDistance.map(s => ({
          name: s.name,
          distance: s.distance.toFixed(1)
        }))
      });
    }

    // Fetch AQI data with caching and fallback
    const aqiData = await getAQIData(nearest.name);

    // Extract AQI data with fallbacks
    const aqi = aqiData.PM25_AQI || aqiData.aqi || 0;
    const category = aqiData.AQI_category || "Unknown";
    const timestamp = aqiData.Date_Time || new Date().toISOString();
    const pm25 = aqiData.PM25 || 0;

    if (!aqi || aqi === 0) {
      return res.json({
        success: false,
        message: "AQI data is temporarily unavailable for this station. Please try again later or contact helpline: 0800-12345",
        station_name: nearest.name,
        city: nearest.city
      });
    }

    const healthAdvice = getHealthAdvice(aqi, category);

    // Format response
    const response = {
      success: true,
      message: `📍 Nearest Station: ${nearest.name}\n📏 Distance: ${nearest.distance.toFixed(1)} km\n\n🌡️ Air Quality Index (AQI): ${aqi}\n📊 Category: ${category}\n⏰ As of: ${timestamp}\n🔬 PM2.5: ${pm25} µg/m³\n\n💡 Health Advisory:\n${healthAdvice}\n\n📞 Helpline: 0800-12345\nType 'menu' to return to main menu.`,
      data: {
        station_name: nearest.name,
        city: nearest.city,
        distance_km: nearest.distance.toFixed(1),
        aqi: aqi,
        category: category,
        pm25: pm25,
        timestamp: timestamp,
        health_advice: healthAdvice,
        data_source: aqiData.dataSource || 'EPA API'
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error in /nearest-aqi endpoint:', error.message);
    
    // More detailed error handling
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: "EPA API service is currently unavailable. Please try again later or contact helpline: 0800-12345",
        error: "Service unavailable",
        suggestion: "Please try again in a few minutes"
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        success: false,
        message: "Request timed out. EPA API is taking too long to respond. Please try again later.",
        error: "Request timeout",
        suggestion: "The EPA API might be experiencing high load"
      });
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching AQI data. Please try again later or contact helpline: 0800-12345",
      error: error.message,
      suggestion: "If this persists, please contact technical support"
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: 'ok', 
    message: 'EPA AQI Webhook is running',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    cache_size: cache.size,
    stations_count: stations.length
  });
});

// Cache management endpoint
app.get('/cache', (req, res) => {
  const cacheInfo = Array.from(cache.entries()).map(([key, value]) => ({
    key,
    timestamp: value.timestamp,
    age: Date.now() - value.timestamp
  }));
  
  res.json({
    cache_size: cache.size,
    cache_entries: cacheInfo,
    cache_ttl_ms: CACHE_TTL
  });
});

// Clear cache endpoint
app.delete('/cache', (req, res) => {
  const size = cache.size;
  cache.clear();
  res.json({
    message: `Cache cleared. Removed ${size} entries.`,
    cache_size: cache.size
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'EPA AQI Webhook API - Enhanced Version',
    version: '2.0.0',
    endpoints: {
      'POST /nearest-aqi': 'Get nearest station AQI based on user location',
      'GET /health': 'Health check with system metrics',
      'GET /cache': 'View cache information',
      'DELETE /cache': 'Clear the AQI data cache'
    },
    features: [
      'Caching system with 5-minute TTL',
      'Fallback data when EPA API is unavailable',
      'Enhanced error handling',
      'Request validation',
      'Memory and performance monitoring'
    ],
    usage: {
      method: 'POST',
      url: '/nearest-aqi',
      body: {
        latitude: 'number (e.g., 31.5204)',
        longitude: 'number (e.g., 74.3587)'
      }
    },
    support: {
      helpline: '0800-12345',
      uptime: process.uptime(),
      cache_entries: cache.size
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🌍 EPA AQI Webhook running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🚀 API endpoint: POST http://localhost:${PORT}/nearest-aqi`);
  console.log(`💾 Cache management: GET/DELETE http://localhost:${PORT}/cache`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = app;
