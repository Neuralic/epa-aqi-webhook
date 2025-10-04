const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 30 Monitoring Stations with coordinates
const stations = [
  { name: "Safari Park-LHR", lat: 31.386128, lon: 74.211615, city: "Lahore" },
  { name: "Kahna Nau Hospital-LHR", lat: 31.371349, lon: 74.364925, city: "Lahore" },
  { name: "PKLI-LHR", lat: 31.455567, lon: 74.464160, city: "Lahore" },
  { name: "FMDRC-LHR", lat: 31.491538, lon: 74.335076, city: "Lahore" },
  { name: "UET-LHR", lat: 31.578625, lon: 74.357510, city: "Lahore" },
  { name: "LWMC-LHR", lat: 31.479303, lon: 74.266274, city: "Lahore" },
  { name: "Punjab University-LHR", lat: 31.560210, lon: 74.331020, city: "Lahore" },
  { name: "Govt. Teaching Hospital Shahdara-LHR", lat: 31.637972, lon: 74.284876, city: "Lahore" },
  { name: "DHQ Sheikhupura", lat: 31.71205, lon: 73.97878, city: "Lahore" },
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
  { name: "M. Nawaz Sharif University of Engineering & Technology Multan", lat: 30.16533, lon: 71.49686, city: "Multan" },
  { name: "IUB (Baghdad Campus) Bahawalpur", lat: 29.379000, lon: 71.765167, city: "Bahawalpur" },
  { name: "IUB (Khawaja Fareed Campus) Bahawalpur", lat: 29.39565, lon: 71.66236, city: "Bahawalpur" },
  { name: "DC Office Sargodha", lat: 32.0724, lon: 72.6727, city: "Sargodha" },
  { name: "BISE Sargodha", lat: 32.035170, lon: 72.700550, city: "Sargodha" },
  { name: "DC Office Sialkot", lat: 32.505310, lon: 74.534230, city: "Sialkot" },
  { name: "DC Office DG Khan", lat: 30.05172, lon: 70.62965, city: "D.G. Khan" },
  { name: "DC Office Rawalpindi", lat: 33.58461, lon: 73.0689, city: "Rawalpindi" },
  { name: "ARID University Rawalpindi", lat: 33.64932, lon: 73.08156, city: "Rawalpindi" },
  { name: "Drug Testing Laboratory Rawalpindi", lat: 33.54223, lon: 73.0139, city: "Rawalpindi" }
];

// Cache for AQI data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Storage for subscriber AQI results
const subscriberResults = new Map();
const RESULT_TTL = 30 * 60 * 1000; // 30 minutes

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fetch AQI data from EPA API
async function fetchAQIData() {
  const cacheKey = 'all_aqi';
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return { data: cached.data, source: 'cache' };
    }
  }

  try {
    const apiUrl = 'https://api.epd-aqms-pk.com/aqi';
    const response = await axios.get(apiUrl, { timeout: 15000 });
    
    cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    return { data: response.data, source: 'api' };
  } catch (error) {
    if (cache.has(cacheKey)) {
      return { data: cache.get(cacheKey).data, source: 'stale_cache' };
    }
    throw error;
  }
}

// Get health advice based on AQI value
function getHealthAdvice(aqi) {
  if (aqi <= 50) return "Good. Air quality is satisfactory. Enjoy outdoor activities.";
  if (aqi <= 100) return "Moderate. Acceptable for most, but sensitive individuals should limit prolonged outdoor exertion.";
  if (aqi <= 150) return "Unhealthy for sensitive groups. Children, elderly, and people with respiratory/heart conditions should limit outdoor activities.";
  if (aqi <= 200) return "Unhealthy. Everyone should limit prolonged outdoor exertion. Use N95 masks outdoors.";
  if (aqi <= 300) return "Very Unhealthy. Avoid all outdoor activities. Keep windows closed. Use air purifiers indoors.";
  return "Hazardous. Stay indoors. Avoid all physical activities. Seek medical help if experiencing symptoms.";
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'EPA AQI Webhook is running' });
});

// Test endpoint
app.post('/test', (req, res) => {
  res.json({ 
    received: req.body,
    message: 'Test endpoint working'
  });
});

// NEW: BotSailor GPS Location Integration
app.post('/botsailor-location', async (req, res) => {
  try {
    const { subscriber_id, phone_number } = req.body;
    
    console.log('Received from BotSailor:', { subscriber_id, phone_number });
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    // Step 1: Get last 2 messages from BotSailor to extract GPS location
    const botsailorApiUrl = `https://convodat.site/api/v1/whatsapp/get/conversation?apiToken=13881|CsusyanDTZNgwDfofBDycCCmiBmkfd0G5R9vN7Qtca3c6006&phone_number_id=740840432454977&phone_number=${phone_number}&limit=2&offset=1`;
    
    const conversationResponse = await axios.get(botsailorApiUrl, { timeout: 15000 });
    
    console.log('BotSailor API Response received');
    
    // Step 2: Extract location from messages
    let latitude = null;
    let longitude = null;
    
    // Parse the conversation data to find location
    if (conversationResponse.data && conversationResponse.data.message) {
      const messages = JSON.parse(conversationResponse.data.message);
      
      // Look through messages for location data
      for (const key in messages) {
        const messageContent = messages[key].message_content;
        if (messageContent) {
          const parsedContent = JSON.parse(messageContent);
          
          // Check if this message contains location data
          if (parsedContent.entry && parsedContent.entry[0]?.changes) {
            const msgs = parsedContent.entry[0].changes[0]?.value?.messages;
            if (msgs && msgs[0]?.location) {
              latitude = msgs[0].location.latitude;
              longitude = msgs[0].location.longitude;
              break;
            }
          }
        }
      }
    }
    
    if (!latitude || !longitude) {
      return res.json({
        success: false,
        message: "No location data found in recent messages. Please share your location first."
      });
    }

    console.log('Extracted GPS:', { latitude, longitude });

    // Step 3: Find nearest station
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const stationsWithDistance = stations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    // Step 4: Get AQI data
    const { data: allStationsData } = await fetchAQIData();
    const aqiData = allStationsData[nearest.name];

    if (!aqiData || !aqiData.AQI) {
      return res.json({
        success: false,
        message: `AQI data unavailable for ${nearest.name}. Please try again later or contact helpline: 0800-12345`,
        distance: nearest.distance.toFixed(1),
        station_name: nearest.name
      });
    }

    const healthAdvice = getHealthAdvice(aqiData.AQI);

    // Step 5: Return formatted response
    return res.json({
      success: true,
      distance: nearest.distance.toFixed(1),
      station_name: nearest.name,
      aqi: aqiData.AQI.toString(),
      air_category: aqiData.AQI_category,
      pollutant: aqiData.Dominant_Pollutant || "PM2.5",
      last_updated: aqiData.Date_Time,
      health_advice: healthAdvice,
      message: `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*\n\nAQI = ${aqiData.AQI}\nAir Quality: ${aqiData.AQI_category}\nDominant Pollutant: ${aqiData.Dominant_Pollutant || "PM2.5"}\nLast Updated at: ${aqiData.Date_Time}\n\nHealth Advisory:\n${healthAdvice}\n\nHelpline: 0800-12345\nType 'menu' to return to main menu.`
    });

  } catch (error) {
    console.error('Error in botsailor-location endpoint:', error.message);
    return res.json({
      success: false,
      message: "Error processing location. Please try again or contact helpline: 0800-12345"
    });
  }
});

// Original nearest-aqi endpoint (for city-based approach)
app.post('/nearest-aqi', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.json({ 
        success: false, 
        message: "Please provide valid coordinates" 
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const stationsWithDistance = stations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    const { data: allStationsData } = await fetchAQIData();
    const aqiData = allStationsData[nearest.name];

    if (!aqiData || !aqiData.AQI) {
      return res.json({ 
        success: false, 
        message: `AQI data unavailable for ${nearest.name}. Please try again later or contact helpline: 0800-12345`,
        station_name: nearest.name,
        distance_km: nearest.distance.toFixed(1)
      });
    }

    const healthAdvice = getHealthAdvice(aqiData.AQI);
    
    const message = `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*\n\nAQI = ${aqiData.AQI}\nAir Quality: ${aqiData.AQI_category}\nDominant Pollutant: ${aqiData.Dominant_Pollutant || "PM2.5"}\nLast Updated at: ${aqiData.Date_Time}\n\nHealth Advisory:\n${healthAdvice}\n\nHelpline: 0800-12345\nType 'menu' to return to main menu.`;

    return res.json({
      success: true,
      message: message,
      station_name: nearest.name,
      city: nearest.city,
      distance_km: nearest.distance.toFixed(1),
      aqi: aqiData.AQI.toString(),
      category: aqiData.AQI_category,
      dominant_pollutant: aqiData.Dominant_Pollutant || "PM2.5",
      timestamp: aqiData.Date_Time,
      health_advice: healthAdvice
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.json({ 
      success: false, 
      message: "Error fetching AQI data. Contact: 0800-12345" 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
