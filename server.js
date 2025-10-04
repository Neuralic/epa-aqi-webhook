const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// In-memory storage for GPS results (expires after 30 minutes)
const gpsResults = new Map();

// Clean up old results every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of gpsResults.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) {
      gpsResults.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Function to fetch live stations from EPA API
async function fetchStations() {
  try {
    const response = await axios.get('https://api.epd-aqms-pk.com/coordinates', { timeout: 10000 });
    const stationsData = response.data;
    
    const stationsArray = Object.keys(stationsData).map(name => ({
      name: name,
      lat: stationsData[name].lat,
      lon: stationsData[name].lng
    }));
    
    console.log(`Fetched ${stationsArray.length} live stations from EPA API`);
    return stationsArray;
  } catch (error) {
    console.error('Error fetching stations from EPA API:', error.message);
    return [
      { name: "Safari Park-LHR", lat: 31.3823, lon: 74.2182 },
      { name: "Kahna Nau Hospital-LHR", lat: 31.3710, lon: 74.3651 },
      { name: "PKLI-LHR", lat: 31.4559, lon: 74.4638 },
      { name: "FMDRC-LHR", lat: 31.5359, lon: 74.4352 },
      { name: "UET-LHR", lat: 31.5798, lon: 74.3550 },
      { name: "LWMC-LHR", lat: 31.4638, lon: 74.2259 },
      { name: "Punjab University-LHR", lat: 31.4797, lon: 74.2661 },
      { name: "Govt. Teaching Hospital Shahdara-LHR", lat: 31.6381, lon: 74.2852 },
      { name: "DHQ Sheikhupura", lat: 31.7119, lon: 73.9789 },
      { name: "DC Office Faisalabad", lat: 31.4254, lon: 73.0812 },
      { name: "GCU Faisalabad", lat: 31.4162, lon: 73.0700 },
      { name: "NTU Faisalabad", lat: 31.4621, lon: 73.1485 },
      { name: "BZU Multan", lat: 30.2623, lon: 71.5125 },
      { name: "M. Nawaz Sharif University of Engineering & Technology Multan", lat: 30.0291, lon: 71.5415 },
      { name: "DC Office Rawalpindi", lat: 33.5846, lon: 73.0689 },
      { name: "Drug Testing Laboratory Rawalpindi", lat: 33.5423, lon: 73.0139 },
      { name: "ARID University Rawalpindi", lat: 33.6506, lon: 73.0807 },
      { name: "DC Office Gujranwala", lat: 32.1747, lon: 74.1951 },
      { name: "GCW Gujranwala", lat: 32.2559, lon: 74.1595 },
      { name: "BISE Sargodha", lat: 32.0356, lon: 72.7006 },
      { name: "DC Office Sargodha", lat: 32.0716, lon: 72.6728 },
      { name: "DC Office Sialkot", lat: 32.5053, lon: 74.5330 },
      { name: "IUB (Khawaja Fareed Campus) Bahawalpur", lat: 29.3977, lon: 71.6916 },
      { name: "IUB (Baghdad Campus) Bahawalpur", lat: 29.3768, lon: 71.7627 },
      { name: "DC Office DG Khan", lat: 30.0518, lon: 70.6297 }
    ];
  }
}

// Helper function to calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to fetch AQI data for all stations
async function fetchAQIData() {
  const response = await axios.get('https://api.epd-aqms-pk.com/aqi', {
    timeout: 15000,
  });
  return response.data;
}

// Helper function to get health advice based on AQI
function getHealthAdvice(aqi) {
  if (aqi <= 50) {
    return "Air quality is good. Enjoy outdoor activities!";
  } else if (aqi <= 100) {
    return "Air quality is acceptable. Sensitive individuals should consider limiting prolonged outdoor exertion.";
  } else if (aqi <= 150) {
    return "Unhealthy for sensitive groups. Children, elderly, and people with respiratory/heart conditions should limit outdoor activities.";
  } else if (aqi <= 200) {
    return "Unhealthy. Everyone should limit prolonged outdoor exertion. Sensitive groups should avoid outdoor activities.";
  } else if (aqi <= 300) {
    return "Very unhealthy. Everyone should avoid prolonged outdoor exertion. Use N95 masks if going outside.";
  } else {
    return "Hazardous. Everyone should avoid all outdoor activities. Stay indoors with air purifiers.";
  }
}

// Original endpoint for city-based AQI
app.post('/nearest-aqi', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const liveStations = await fetchStations();
    
    const stationsWithDistance = liveStations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    const allStationsData = await fetchAQIData();
    const aqiData = allStationsData[nearest.name];

    if (!aqiData || !aqiData.AQI) {
      return res.json({
        success: false,
        message: `AQI data unavailable for ${nearest.name}. Please try again later.`,
        station_name: nearest.name,
        distance: nearest.distance.toFixed(1)
      });
    }

    const healthAdvice = getHealthAdvice(aqiData.AQI);

    return res.json({
      success: true,
      message: `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*\n\nAQI = ${aqiData.AQI}\nAir Quality: ${aqiData.AQI_category}\nDominant Pollutant: ${aqiData.Dominant_Pollutant || "PM2.5"}\nLast Updated at: ${aqiData.Date_Time}\n\nHealth Advisory:\n${healthAdvice}\n\nHelpline: 0800-12345\nType 'menu' to return to main menu.`,
      distance: nearest.distance.toFixed(1),
      station_name: nearest.name,
      aqi: aqiData.AQI.toString(),
      category: aqiData.AQI_category,
      dominant_pollutant: aqiData.Dominant_Pollutant || "PM2.5",
      timestamp: aqiData.Date_Time,
      health_advice: healthAdvice
    });
  } catch (error) {
    console.error('Error in /nearest-aqi:', error.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching AQI data. Please try again later."
    });
  }
});

// New endpoint for BotSailor GPS integration
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

    const botsailorApiUrl = `https://convodat.site/api/v1/whatsapp/get/conversation?apiToken=13881|CsusyanDTZNgwDfofBDycCCmiBmkfd0G5R9vN7Qtca3c6006&phone_number_id=740840432454977&phone_number=${phone_number}&limit=2&offset=1`;
    
    const conversationResponse = await axios.get(botsailorApiUrl, { timeout: 15000 });
    
    console.log('BotSailor API Response:', JSON.stringify(conversationResponse.data, null, 2));
    
    let latitude = null;
    let longitude = null;
    
    if (conversationResponse.data && conversationResponse.data.message) {
      const messages = JSON.parse(conversationResponse.data.message);
      
      for (const key in messages) {
        const messageContent = messages[key].message_content;
        if (messageContent) {
          const parsedContent = JSON.parse(messageContent);
          
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

    const liveStations = await fetchStations();
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const stationsWithDistance = liveStations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    const allStationsData = await fetchAQIData();
    
    console.log('Available stations in AQI data:', allStationsData ? Object.keys(allStationsData).join(', ') : 'none');
    console.log('Looking for station:', nearest.name);
    
    const aqiData = allStationsData ? allStationsData[nearest.name] : null;

    if (!aqiData) {
      console.error('AQI data not found for station:', nearest.name);
      return res.json({
        success: false,
        message: `AQI data unavailable for ${nearest.name}. Please try again later.`,
        distance: nearest.distance.toFixed(1),
        station_name: nearest.name
      });
    }

    const healthAdvice = getHealthAdvice(aqiData.AQI);

    const result = {
      success: true,
      distance: nearest.distance.toFixed(1),
      station_name: nearest.name,
      aqi: aqiData.AQI.toString(),
      air_category: aqiData.AQI_category,
      pollutant: aqiData.Dominant_Pollutant || "PM25",
      last_updated: aqiData.Date_Time,
      health_advice: healthAdvice,
      message: `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*\n\nAQI = ${aqiData.AQI}\nAir Quality: ${aqiData.AQI_category}\nDominant Pollutant: ${aqiData.Dominant_Pollutant || "PM25"}\nLast Updated at: ${aqiData.Date_Time}\n\nHealth Advisory:\n${healthAdvice}\n\nHelpline: 0800-12345\nType 'menu' to return to main menu.`,
      timestamp: Date.now()
    };

    gpsResults.set(subscriber_id, result);
    return res.json(result);

  } catch (error) {
    console.error('Error in botsailor-location endpoint:', error.message);
    return res.json({
      success: false,
      message: "Error processing location. Please try again or contact helpline: 0800-12345"
    });
  }
});

app.get('/get-aqi/:subscriber_id', (req, res) => {
  const { subscriber_id } = req.params;
  
  const result = gpsResults.get(subscriber_id);
  
  if (!result) {
    return res.json({
      success: false,
      message: "No location data found. Please share your location first."
    });
  }
  
  return res.json(result);
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'EPA AQI Webhook Server Running',
    endpoints: {
      cityBased: 'POST /nearest-aqi',
      gpsStore: 'POST /botsailor-location',
      gpsRetrieve: 'GET /get-aqi/:subscriber_id'
    }
  });
});

app.listen(PORT, () => {
  console.log(`EPA AQI server running on port ${PORT}`);
});
