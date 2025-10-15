// EPA AQI Webhook for BotSailor Integration
// Updated with API Key Authentication (October 2025)

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// EPA API Configuration
const EPA_API_BASE = 'https://api.epd-aqms-pk.com';
const EPA_API_KEY = process.env.EPA_API_KEY; // Get from environment variable

// BotSailor API Configuration
const BOTSAILOR_API_KEY = process.env.BOTSAILOR_API_KEY;
const BOTSAILOR_BOT_ID = process.env.BOTSAILOR_BOT_ID || '232253';

// Temporary storage for location data (30 minutes TTL)
const locationStore = new Map();
const STORAGE_TTL = 30 * 60 * 1000; // 30 minutes

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of locationStore.entries()) {
    if (now - value.timestamp > STORAGE_TTL) {
      locationStore.delete(key);
      console.log(`Cleaned up expired data for: ${key}`);
    }
  }
}, 5 * 60 * 1000);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'EPA AQI Webhook Running',
    version: '2.0',
    apiKeyConfigured: !!EPA_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Helper: Make authenticated EPA API request
async function epaApiRequest(endpoint, params = {}) {
  if (!EPA_API_KEY) {
    throw new Error('EPA API Key not configured');
  }

  try {
    const response = await axios.get(`${EPA_API_BASE}${endpoint}`, {
      headers: {
        'X-API-Key': EPA_API_KEY
      },
      params
    });
    return response.data;
  } catch (error) {
    console.error(`EPA API Error for ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Helper: Calculate distance between two points (Haversine formula)
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

// Helper: Get health advice based on AQI
function getHealthAdvice(aqi, category) {
  if (aqi <= 50) {
    return "Air quality is good. Enjoy outdoor activities!";
  } else if (aqi <= 100) {
    return "Air quality is acceptable. Unusually sensitive people should limit prolonged outdoor exertion.";
  } else if (aqi <= 150) {
    return "Unhealthy for sensitive groups. People with respiratory issues should limit outdoor activities.";
  } else if (aqi <= 200) {
    return "Unhealthy. Everyone may experience health effects. Sensitive groups should avoid outdoor activities.";
  } else if (aqi <= 300) {
    return "Very Unhealthy. Health alert! Everyone should avoid prolonged outdoor exertion.";
  } else {
    return "Hazardous. Health warnings of emergency conditions. Everyone should avoid outdoor activities.";
  }
}

// ENDPOINT: Store location and calculate AQI
app.post('/botsailor-location', async (req, res) => {
  try {
    const { subscriber_id, phone_number } = req.body;
    console.log('Received from BotSailor:', { subscriber_id, phone_number });

    if (!subscriber_id || !phone_number) {
      return res.status(400).json({ error: 'Missing subscriber_id or phone_number' });
    }

    // Fetch conversation from BotSailor to get GPS location
    const botsailorUrl = `https://app.botsailor.com/api/conversation/load-conversation?subscriber_id=${subscriber_id}&bot_id=${BOTSAILOR_BOT_ID}`;
    const botsailorResponse = await axios.get(botsailorUrl, {
      headers: { 'X-API-KEY': BOTSAILOR_API_KEY }
    });

    console.log('BotSailor API Response:', botsailorResponse.data);

    const messages = JSON.parse(botsailorResponse.data.message);
    let gpsLocation = null;
    let latestTimestamp = 0;

    // Find the most recent GPS location
    for (const msgId in messages) {
      const msg = messages[msgId];
      if (msg.sender === 'user') {
        try {
          const content = JSON.parse(msg.message_content);
          if (content.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const message = content.entry[0].changes[0].value.messages[0];
            const timestamp = parseInt(message.timestamp);
            
            if (message.type === 'location' && message.location && timestamp > latestTimestamp) {
              gpsLocation = {
                lat: message.location.latitude,
                lng: message.location.longitude,
                name: message.location.name || 'N/A',
                address: message.location.address || 'N/A'
              };
              latestTimestamp = timestamp;
              console.log(`Found GPS location at timestamp ${timestamp}:`, gpsLocation);
            }
          }
        } catch (e) {
          // Skip messages that can't be parsed
        }
      }
    }

    if (!gpsLocation) {
      return res.status(400).json({ error: 'No GPS location found in conversation' });
    }

    console.log('Extracted GPS location:', { latitude: gpsLocation.lat, longitude: gpsLocation.lng });

    // Fetch station coordinates from EPA API (with authentication)
    const coordinatesData = await epaApiRequest('/coordinates');
    console.log(`Fetched ${Object.keys(coordinatesData).length} live stations from EPA API`);

    // Find nearest station
    let nearestStation = null;
    let minDistance = Infinity;

    for (const [stationName, coords] of Object.entries(coordinatesData)) {
      const distance = calculateDistance(gpsLocation.lat, gpsLocation.lng, coords.lat, coords.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = stationName;
      }
    }

    if (!nearestStation) {
      return res.status(404).json({ error: 'No nearby stations found' });
    }

    // Fetch AQI data for nearest station (with authentication)
    const aqiData = await epaApiRequest(`/aqi/${encodeURIComponent(nearestStation)}`);
    console.log(`AQI data for ${nearestStation}:`, aqiData);

    if (aqiData.error) {
      return res.status(404).json({ error: `No AQI data available for ${nearestStation}` });
    }

    // Store the result
    const result = {
      distance: minDistance.toFixed(2),
      station_name: nearestStation,
      aqi: aqiData.AQI || 'N/A',
      air_category: aqiData.AQI_category || 'N/A',
      pollutant: aqiData.Dominant_Pollutant || 'N/A',
      last_updated: aqiData.Date_Time || 'N/A',
      health_advice: getHealthAdvice(aqiData.AQI, aqiData.AQI_category),
      timestamp: Date.now()
    };

    locationStore.set(subscriber_id, result);
    console.log(`Stored AQI data for ${subscriber_id}`);

    res.json({ 
      success: true,
      message: 'Location processed and AQI data stored',
      data: result
    });

  } catch (error) {
    console.error('Error processing location:', error.message);
    res.status(500).json({ 
      error: 'Failed to process location',
      details: error.message 
    });
  }
});

// ENDPOINT: Retrieve stored AQI data
app.get('/get-aqi/:subscriber_id', (req, res) => {
  try {
    const { subscriber_id } = req.params;
    const data = locationStore.get(subscriber_id);

    if (!data) {
      return res.status(404).json({ 
        error: 'No data found for this subscriber',
        hint: 'Data expires after 30 minutes or may not have been stored yet'
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error retrieving AQI:', error.message);
    res.status(500).json({ error: 'Failed to retrieve AQI data' });
  }
});

// ENDPOINT: City average AQI (with authentication)
app.get('/aqi-city/:cityname', async (req, res) => {
  try {
    const cityName = req.params.cityname;
    console.log(`Fetching AQI data for city: ${cityName}`);

    // Map city to search pattern
    const cityPatterns = {
      'Lahore': 'LHR',
      'Faisalabad': 'Faisalabad',
      'Multan': 'Multan',
      'Rawalpindi': 'Rawalpindi',
      'Gujranwala': 'Gujranwala',
      'Sialkot': 'Sialkot',
      'Sargodha': 'Sargodha',
      'Bahawalpur': 'Bahawalpur',
      'Sheikhupura': 'Sheikhupura',
      'D.G. Khan': 'DG Khan',
      'DG Khan': 'DG Khan'
    };

    const pattern = cityPatterns[cityName];
    if (!pattern) {
      return res.status(400).json({ error: 'City not supported' });
    }

    // Fetch all AQI data (with authentication)
    const aqiData = await epaApiRequest('/aqi');
    console.log(`City input: ${cityName} Pattern to search: ${pattern}`);

    // Filter stations for this city
    const cityStations = Object.entries(aqiData).filter(([name]) => 
      name.includes(pattern)
    );

    console.log(`Found stations: ${cityStations.length}`, cityStations.map(([name]) => name));

    if (cityStations.length === 0) {
      return res.status(404).json({ error: `No stations found for ${cityName}` });
    }

    // Calculate average AQI
    const validReadings = cityStations
      .map(([, data]) => data.AQI)
      .filter(aqi => aqi !== null && !isNaN(aqi));

    if (validReadings.length === 0) {
      return res.status(404).json({ error: 'No valid AQI data available' });
    }

    const avgAQI = Math.round(
      validReadings.reduce((sum, aqi) => sum + aqi, 0) / validReadings.length
    );

    // Determine category
    let category = 'Good';
    if (avgAQI > 300) category = 'Hazardous';
    else if (avgAQI > 200) category = 'Very Unhealthy';
    else if (avgAQI > 150) category = 'Unhealthy';
    else if (avgAQI > 100) category = 'Unhealthy for Sensitive Groups';
    else if (avgAQI > 50) category = 'Moderate';

    res.json({
      city: cityName,
      average_aqi: avgAQI,
      category: category,
      stations_count: cityStations.length,
      stations: cityStations.map(([name, data]) => ({
        name,
        aqi: data.AQI,
        category: data.AQI_category,
        pollutant: data.Dominant_Pollutant,
        last_updated: data.Date_Time
      })),
      health_advice: getHealthAdvice(avgAQI, category)
    });

  } catch (error) {
    console.error('Error fetching city AQI:', error.message);
    res.status(500).json({ error: 'Failed to fetch city AQI data' });
  }
});

// ENDPOINT: Nearest station (legacy endpoint with authentication)
app.get('/nearest-aqi', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng parameters' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Fetch coordinates with authentication
    const coordinatesData = await epaApiRequest('/coordinates');

    let nearestStation = null;
    let minDistance = Infinity;

    for (const [stationName, coords] of Object.entries(coordinatesData)) {
      const distance = calculateDistance(latitude, longitude, coords.lat, coords.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = stationName;
      }
    }

    if (!nearestStation) {
      return res.status(404).json({ error: 'No nearby stations found' });
    }

    // Fetch AQI with authentication
    const aqiData = await epaApiRequest(`/aqi/${encodeURIComponent(nearestStation)}`);

    res.json({
      distance: minDistance.toFixed(2),
      station: nearestStation,
      aqi_data: aqiData
    });

  } catch (error) {
    console.error('Error fetching nearest AQI:', error.message);
    res.status(500).json({ error: 'Failed to fetch AQI data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ EPA AQI Webhook server running on port ${PORT}`);
  console.log(`✅ API Key configured: ${!!EPA_API_KEY}`);
  console.log(`✅ EPA API Base: ${EPA_API_BASE}`);
});
