const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

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
function getHealthAdvice(aqi) {
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

    // Calculate distances to all stations
    const stationsWithDistance = stations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    // Sort by distance and find nearest
    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    // --- MODIFIED SECTION START ---
    // Fetch ALL AQI data from EPA API and then extract for the nearest station
    const allAqiDataUrl = `https://api.epd-aqms-pk.com/aqi`; // Base URL to get all data
    const allAqiResponse = await axios.get(allAqiDataUrl, { timeout: 10000 } );

    const allAqiData = allAqiResponse.data;

    // Extract data for the nearest station using its name as the key
    const aqiData = allAqiData[nearest.name];

    // Check if data is available for the specific station and has the AQI property
    if (!aqiData || !aqiData.AQI) {
      return res.json({
        success: false,
        message: `AQI data is temporarily unavailable for ${nearest.name}.\n\nPlease try again later or contact helpline: 0800-12345\n\nType 'menu' to return to main menu.`
      });
    }

    const aqi = aqiData.AQI; // Use aqiData.AQI as per the provided JSON
    const category = aqiData.AQI_category || "Unknown";
    const timestamp = aqiData.Date_Time;
    const pm25 = aqiData.Dominant_Pollutant; // Using Dominant_Pollutant as a placeholder for PM2.5 if actual PM2.5 is not available
    // If you need actual PM2.5, you'll need to confirm its exact path in the external API's response for a specific station.
    // --- MODIFIED SECTION END ---

    const healthAdvice = getHealthAdvice(aqi);

    // Format response
    const response = {
      success: true,
      message: `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*\nAQI = ${aqi}\nAir Quality : ${category}\nDominant Pollutant: ${pm25}\nLast Updated at: ${timestamp}`,
      data: {
        station_name: nearest.name,
        city: nearest.city,
        distance_km: nearest.distance.toFixed(1),
        aqi: aqi,
        category: category,
        pm25: pm25,
        timestamp: timestamp,
        health_advice: healthAdvice
      }
    };

    return res.json(response);

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching AQI data. Please try again later or contact helpline: 0800-12345",
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'EPA AQI Webhook is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'EPA AQI Webhook API',
    version: '1.0.0',
    endpoints: {
      'POST /nearest-aqi': 'Get nearest station AQI based on user location',
      'GET /health': 'Health check'
    },
    usage: {
      method: 'POST',
      url: '/nearest-aqi',
      body: {
        latitude: 'number (e.g., 31.5204)',
        longitude: 'number (e.g., 74.3587)'
      },
      example: {
        latitude: 31.5204,
        longitude: 74.3587
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`EPA AQI Webhook running on port ${PORT}`);
});
