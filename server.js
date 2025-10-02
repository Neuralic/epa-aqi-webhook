const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Production cache configuration
const cache = {
  data: null,
  timestamp: 0,
  TTL: 5 * 60 * 1000 // 5 minutes cache
};

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

// Static fallback data (last known good values) - UPDATE THESE REGULARLY
const staticFallback = {
  "Safari Park-LHR": { AQI: 159, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "PM2.5" },
  "Kahna Nau Hospital-LHR": { AQI: 164, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "PM2.5" },
  "PKLI-LHR": { AQI: 163, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "PM2.5" },
  "FMDRC-LHR": { AQI: 166, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "PM2.5" },
  "UET-LHR": { AQI: 159, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "CO" },
  "LWMC-LHR": { AQI: 162, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 19:55:00", Dominant_Pollutant: "PM2.5" },
  "Punjab University-LHR": { AQI: 157, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "PM2.5" },
  "Govt. Teaching Hospital Shahdara-LHR": { AQI: 142, AQI_category: "Moderate", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "PM10" },
  "DHQ Sheikhupura": { AQI: 227, AQI_category: "Unhealthy", Date_Time: "2025-10-02 20:00:00", Dominant_Pollutant: "CO" },
  "Mobile 1": { AQI: 215, AQI_category: "Unhealthy", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "Mobile 2": { AQI: 156, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 19:10:00", Dominant_Pollutant: "PM2.5" },
  "Mobile 3": { AQI: 172, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "Mobile 4": { AQI: 166, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "Mobile 5": { AQI: 150, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "DC Office Faisalabad": { AQI: 156, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 13:00:00", Dominant_Pollutant: "PM2.5" },
  "GCU Faisalabad": { AQI: 131, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "NTU Faisalabad": { AQI: 130, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "GCW Gujranwala": { AQI: 150, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "DC Office Gujranwala": { AQI: 129, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM2.5" },
  "BZU Multan": { AQI: 127, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "IUB (Baghdad Campus) Bahawalpur": { AQI: 109, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "DC Office Sargodha": { AQI: 133, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "BISE Sargodha": { AQI: 147, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "DC Office Sialkot": { AQI: 147, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "IUB (Khawaja Fareed Campus) Bahawalpur": { AQI: 93, AQI_category: "Satisfactory", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "DC Office DG Khan": { AQI: 111, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "DC Office Rawalpindi": { AQI: 158, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "NO2" },
  "ARID University Rawalpindi": { AQI: 112, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "Drug Testing Laboratory Rawalpindi": { AQI: 156, AQI_category: "Unhealthy for sensitive group", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" },
  "M. Nawaz Sharif University of Engineering & Technology Multan": { AQI: 124, AQI_category: "Moderate", Date_Time: "2025-10-02 20:25:00", Dominant_Pollutant: "PM10" }
};

// Distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Health advice
function getHealthAdvice(aqi) {
  if (aqi <= 50) return "Air quality is Good. Enjoy outdoor activities!";
  if (aqi <= 100) return "Air quality is Moderate. Unusually sensitive people should consider reducing prolonged outdoor exertion.";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups. Children, elderly, and people with respiratory conditions should limit outdoor activities.";
  if (aqi <= 200) return "Unhealthy. Everyone should limit prolonged outdoor exertion. Use N95 masks outdoors.";
  if (aqi <= 300) return "Very Unhealthy. Avoid all outdoor activities. Stay indoors with air purifiers. Use N95 masks if you must go out.";
  return "Hazardous. Avoid ALL outdoor exposure. Close windows. Use air purifiers. Seek medical attention if experiencing symptoms.";
}

// Fetch AQI with multi-layer fallback
async function fetchAQIData() {
  // Layer 1: Check cache
  if (cache.data && (Date.now() - cache.timestamp < cache.TTL)) {
    console.log('Using cached AQI data');
    return { data: cache.data, source: 'cache' };
  }

  // Layer 2: Try EPA API with aggressive timeout
  try {
    console.log('Fetching fresh AQI data from EPA API...');
    const response = await axios.get('https://api.epd-aqms-pk.com/aqi', {
      timeout: 8000, // 8 second timeout
      headers: { 'Accept': 'application/json' }
    });
    
    // Update cache
    cache.data = response.data;
    cache.timestamp = Date.now();
    console.log('EPA API success - cache updated');
    
    return { data: response.data, source: 'api' };
  } catch (error) {
    console.error('EPA API failed:', error.message);
    
    // Layer 3: Use stale cache if available
    if (cache.data) {
      console.log('Using stale cache data');
      return { data: cache.data, source: 'stale_cache' };
    }
    
    // Layer 4: Use static fallback
    console.log('Using static fallback data');
    return { data: staticFallback, source: 'fallback' };
  }
}

// Background refresh (keeps cache warm)
async function backgroundRefresh() {
  try {
    const response = await axios.get('https://api.epd-aqms-pk.com/aqi', {
      timeout: 15000,
      headers: { 'Accept': 'application/json' }
    });
    cache.data = response.data;
    cache.timestamp = Date.now();
    console.log('Background refresh successful');
  } catch (error) {
    console.log('Background refresh failed:', error.message);
  }
}

// Refresh cache every 5 minutes
setInterval(backgroundRefresh, 5 * 60 * 1000);

// Main endpoint
app.post('/nearest-aqi', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Please provide latitude and longitude"
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLon)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates provided"
      });
    }

    // Find nearest station
    const stationsWithDistance = stations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    if (nearest.distance > 20) {
      return res.json({
        success: false,
        message: `Sorry, there is no monitoring station near your location. The nearest station is ${nearest.distance.toFixed(1)}km away in ${nearest.city}.\n\nFor air quality information, contact helpline: 0800-12345\n\nType 'menu' to return to main menu.`,
        nearest_station: nearest.name,
        distance_km: nearest.distance.toFixed(1),
        city: nearest.city
      });
    }

    // Fetch AQI data with fallback
    const { data: allStationsData, source } = await fetchAQIData();
    const aqiData = allStationsData[nearest.name];

    if (!aqiData || !aqiData.AQI) {
      return res.json({
        success: false,
        message: `AQI data is temporarily unavailable for ${nearest.name}.\n\nContact helpline: 0800-12345\n\nType 'menu' to return to main menu.`,
        station_name: nearest.name
      });
    }

    const aqi = aqiData.AQI;
    const category = aqiData.AQI_category || "Unknown";
    const timestamp = aqiData.Date_Time;
    const dominantPollutant = aqiData.Dominant_Pollutant || "PM2.5";
    const healthAdvice = getHealthAdvice(aqi);

    // Add data freshness indicator
    const dataNote = source === 'fallback' ? '\n\n(Using recent historical data)' : '';

    const formattedMessage = `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*

AQI = ${aqi}
Air Quality: ${category}
Dominant Pollutant: ${dominantPollutant}
Last Updated at: ${timestamp}${dataNote}

Health Advisory:
${healthAdvice}

Helpline: 0800-12345
Type 'menu' to return to main menu.`;

    return res.json({
      success: true,
      message: formattedMessage,
      station_name: nearest.name,
      city: nearest.city,
      distance_km: nearest.distance.toFixed(1),
      aqi: aqi.toString(),
      category: category,
      dominant_pollutant: dominantPollutant,
      timestamp: timestamp,
      health_advice: healthAdvice,
      data_source: source
    });

  } catch (error) {
    console.error('Endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: "An error occurred. Please try again or contact helpline: 0800-12345",
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cache_age_seconds: cache.data ? Math.floor((Date.now() - cache.timestamp) / 1000) : null,
    cache_status: cache.data ? 'populated' : 'empty'
  });
});

app.post('/test', (req, res) => {
  res.json({ success: true, received: req.body });
});

app.get('/', (req, res) => {
  res.json({
    message: 'EPA AQI Webhook - Production Ready',
    version: '3.0.0',
    features: ['Multi-layer caching', 'Background refresh', 'Static fallback', 'Fast response'],
    endpoints: {
      'POST /nearest-aqi': 'Get AQI for nearest station',
      'GET /health': 'Health check'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`);
  // Do initial cache warm-up
  backgroundRefresh();
});
