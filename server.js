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
    
    // Convert object format to array format
    const stationsArray = Object.keys(stationsData).map(name => ({
      name: name,
      lat: stationsData[name].lat,
      lon: stationsData[name].lng
    }));
    
    console.log(`Fetched ${stationsArray.length} live stations from EPA API`);
    return stationsArray;
  } catch (error) {
    console.error('Error fetching stations from EPA API:', error.message);
    // Fallback to hardcoded stations if API fails
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
  const R = 6371; // Earth's radius in kilometers
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

// Helper function to fetch AQI data for a specific station
async function fetchStationAQI(stationName) {
  // URL encode the station name
  const encodedName = encodeURIComponent(stationName);
  const response = await axios.get(`https://api.epd-aqms-pk.com/aqi/${encodedName}`, {
    timeout: 15000,
  });
  console.log(`AQI data for ${stationName}:`, response.data);
  
  // The API returns data nested: {"Station Name": {AQI, ...}}
  // Extract the actual data object
  if (response.data && typeof response.data === 'object') {
    const stationData = response.data[stationName];
    if (stationData) {
      return stationData;
    }
  }
  
  return response.data;
}

// Helper function to format pollutant names
function formatPollutant(pollutant) {
  if (!pollutant) return "N/A";
  
  // Convert PM25 to PM2.5 and PM10 stays PM10
  if (pollutant === "PM25") return "PM2.5";
  if (pollutant === "PM10") return "PM10";
  
  // Return other pollutants as-is (O3, NO2, SO2, CO, etc.)
  return pollutant;
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

// Helper function to get bilingual health advisories
function getHealthAdvisory(aqi) {
  if (aqi <= 50) {
    return {
      english: "Air quality is good. Ideal for outdoor activities.",
      urdu: "ہوا کا معیار اچھا ہے۔ باہر کی سرگرمیوں کے لیے موزوں ہے۔"
    };
  } else if (aqi <= 100) {
    return {
      english: "Air quality is satisfactory. Unusually sensitive people should consider limiting prolonged outdoor exertion.",
      urdu: "ہوا کا معیار تسلی بخش ہے۔ حساس افراد کو طویل بیرونی سرگرمیوں کو محدود کرنے پر غور کرنا چاہیے۔"
    };
  } else if (aqi <= 150) {
    return {
      english: "Unhealthy for sensitive groups. Children, elderly, pregnant women, and people with respiratory conditions should reduce outdoor activities.",
      urdu: "حساس گروپوں کے لیے نقصان دہ۔ بچوں، بزرگوں، حاملہ خواتین اور سانس کی بیماریوں والے افراد کو بیرونی سرگرمیاں کم کرنی چاہئیں۔"
    };
  } else if (aqi <= 200) {
    return {
      english: "Unhealthy. Everyone should limit prolonged outdoor exertion. Sensitive groups should avoid outdoor activities. Use N95 masks if going outside.",
      urdu: "نقصان دہ۔ سب کو طویل بیرونی سرگرمیاں محدود کرنی چاہئیں۔ حساس گروپس کو باہر جانے سے گریز کرنا چاہیے۔ باہر جاتے وقت N95 ماسک استعمال کریں۔"
    };
  } else if (aqi <= 300) {
    return {
      english: "Very unhealthy. Everyone should avoid all outdoor physical activities. Keep windows closed. Use air purifiers indoors.",
      urdu: "بہت نقصان دہ۔ سب کو تمام بیرونی جسمانی سرگرمیوں سے گریز کرنا چاہیے۔ کھڑکیاں بند رکھیں۔ گھر کے اندر ایئر پیوریفائر استعمال کریں۔"
    };
  } else {
    return {
      english: "Hazardous. Health emergency. Everyone should avoid all outdoor activities. Stay indoors with windows and doors sealed. Use air purifiers.",
      urdu: "انتہائی خطرناک۔ صحت کی ایمرجنسی۔ سب کو تمام بیرونی سرگرمیوں سے گریز کرنا چاہیے۔ کھڑکیاں اور دروازے بند کر کے گھر کے اندر رہیں۔ ایئر پیوریفائر استعمال کریں۔"
    };
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

    // Fetch live stations
    const liveStations = await fetchStations();
    
    const stationsWithDistance = liveStations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    const aqiData = await fetchStationAQI(nearest.name);

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

    // Step 1: Get last 5 messages from BotSailor to extract GPS location
    const botsailorApiUrl = `https://convodat.site/api/v1/whatsapp/get/conversation?apiToken=13881|CsusyanDTZNgwDfofBDycCCmiBmkfd0G5R9vN7Qtca3c6006&phone_number_id=740840432454977&phone_number=${phone_number}&limit=5&offset=1`;
    
    const conversationResponse = await axios.get(botsailorApiUrl, { timeout: 15000 });
    
    console.log('BotSailor API Response:', JSON.stringify(conversationResponse.data, null, 2));
    
    // Step 2: Extract location from messages
    let latitude = null;
    let longitude = null;
    
    if (conversationResponse.data && conversationResponse.data.message) {
      const messages = JSON.parse(conversationResponse.data.message);
      
      for (const key in messages) {
        const messageContent = messages[key].message_content;
        if (messageContent) {
          try {
            const parsedContent = JSON.parse(messageContent);
            
            if (parsedContent.entry && parsedContent.entry[0]?.changes) {
              const msgs = parsedContent.entry[0].changes[0]?.value?.messages;
              if (msgs && msgs[0]?.location) {
                latitude = msgs[0].location.latitude;
                longitude = msgs[0].location.longitude;
                console.log('Found location in message:', key);
                break;
              }
            }
          } catch (parseError) {
            // Skip messages that aren't valid JSON (like "HTTP API triggered")
            console.log(`Skipping non-JSON message: ${messageContent.slice(0, 50)}`);
            continue;
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
    const liveStations = await fetchStations();
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    const stationsWithDistance = liveStations.map(station => ({
      ...station,
      distance: calculateDistance(userLat, userLon, station.lat, station.lon)
    }));

    stationsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearest = stationsWithDistance[0];

    // Step 4: Get AQI data for the nearest station only
    const aqiData = await fetchStationAQI(nearest.name);
    
    if (!aqiData || aqiData.error || !aqiData.AQI) {
      console.error('AQI data not found for station:', nearest.name);
      return res.json({
        success: false,
        message: `AQI data unavailable for ${nearest.name}. Please try again later.`,
        distance: nearest.distance.toFixed(1),
        station_name: nearest.name
      });
    }

    const healthAdvice = getHealthAdvice(aqiData.AQI);
    const advisory = getHealthAdvisory(aqiData.AQI);
    
    // Format pollutant name
    const formattedPollutant = formatPollutant(aqiData.Dominant_Pollutant);

    // Step 5: Store result and return
    const result = {
      success: true,
      distance: nearest.distance.toFixed(1),
      station_name: nearest.name,
      aqi: aqiData.AQI.toString(),
      air_category: aqiData.AQI_category,
      pollutant: formattedPollutant,
      last_updated: aqiData.Date_Time,
      health_advice: healthAdvice,
      advisory_english: advisory.english,
      advisory_urdu: advisory.urdu,
      message: `Your location is ${nearest.distance.toFixed(1)} Km away from Nearest Monitoring Station: *${nearest.name}*\n\nAQI = ${aqiData.AQI}\nAir Quality: ${aqiData.AQI_category}\nDominant Pollutant: ${formattedPollutant}\nLast Updated at: ${aqiData.Date_Time}\n\nHealth Advisory:\n${healthAdvice}\n\nHelpline: 1373\nType 'menu' to return to main menu.`,
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

// Endpoint to retrieve stored GPS results
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

// Health check endpoint
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

// New endpoint: Get AQI for all stations in a city
app.get('/aqi-city/:cityname', async (req, res) => {
  try {
    const { cityname } = req.params;
    
    // Decode URL-encoded characters (+ becomes space, %20 becomes space)
    const decodedCity = decodeURIComponent(cityname.replace(/\+/g, ' '));
    
    console.log(`Fetching AQI data for city: ${decodedCity}`);
    
    // Fetch all AQI data from EPA API
    const response = await axios.get('https://api.epd-aqms-pk.com/aqi', {
      timeout: 15000,
    });
    
    const allAQIData = response.data;
    
    // City suffix mapping
    const citySuffixes = {
      'lahore': 'LHR',
      'lhr': 'LHR',
      'multan': 'Multan',
      'faisalabad': 'Faisalabad',
      'gujranwala': 'Gujranwala',
      'rawalpindi': 'Rawalpindi',
      'sargodha': 'Sargodha',
      'sialkot': 'Sialkot',
      'bahawalpur': 'Bahawalpur',
      'dgkhan': 'DG Khan',
      'dg khan': 'DG Khan',
      'sheikhupura': 'Sheikhupura'
    };
    
    const cityKey = decodedCity.toLowerCase().replace(/\s+/g, '');
    const cityPattern = citySuffixes[cityKey] || decodedCity;
    
    console.log('City input:', decodedCity, 'Pattern to search:', cityPattern);
    
    // Filter stations that match the city
    const cityStations = [];
    for (const stationName in allAQIData) {
      if (stationName.includes(cityPattern)) {
        const stationData = allAQIData[stationName];
        cityStations.push({
          name: stationName,
          aqi: stationData.AQI,
          category: stationData.AQI_category,
          pollutant: formatPollutant(stationData.Dominant_Pollutant),
          updated: stationData.Date_Time
        });
      }
    }
    
    console.log('Found stations:', cityStations.length, cityStations.map(s => s.name));
    
    if (cityStations.length === 0) {
      return res.json({
        success: false,
        message: `No stations found for ${decodedCity}`
      });
    }
    
    // Sort by AQI (highest first)
    cityStations.sort((a, b) => b.aqi - a.aqi);
    
    // Calculate average AQI for the city
    const totalAQI = cityStations.reduce((sum, station) => sum + station.aqi, 0);
    const averageAQI = Math.round(totalAQI / cityStations.length);
    
    // Determine air quality category based on average AQI
    let category;
    if (averageAQI <= 50) category = "Good";
    else if (averageAQI <= 100) category = "Satisfactory";
    else if (averageAQI <= 150) category = "Moderate";
    else if (averageAQI <= 200) category = "Unhealthy for sensitive group";
    else if (averageAQI <= 300) category = "Unhealthy";
    else category = "Hazardous";
    
    // Get most common pollutant
    const pollutantCounts = {};
    cityStations.forEach(station => {
      pollutantCounts[station.pollutant] = (pollutantCounts[station.pollutant] || 0) + 1;
    });
    const dominantPollutant = Object.keys(pollutantCounts).reduce((a, b) => 
      pollutantCounts[a] > pollutantCounts[b] ? a : b
    );
    
    // Get bilingual health advisory
    const advisory = getHealthAdvisory(averageAQI);
    
    // Get the latest update time from all stations
    const latestUpdate = cityStations.reduce((latest, station) => {
      const stationTime = new Date(station.updated);
      const latestTime = new Date(latest);
      return stationTime > latestTime ? station.updated : latest;
    }, cityStations[0].updated);
    
    // Format message with clean visual styling
    let message = `🌫️ *Air Quality - ${decodedCity.toUpperCase()}*\n\n`;
    message += `*Average AQI:* _${averageAQI}_  (${category})\n`;
    message += `*Dominant Pollutant:* ${dominantPollutant}\n`;
    message += `*Monitoring Stations:* ${cityStations.length}\n`;
    message += `*Last Updated:* ${latestUpdate}\n\n`;
    
    return res.json({
      success: true,
      city: decodedCity,
      station_count: cityStations.length,
      average_aqi: averageAQI,
      air_category: category,
      dominant_pollutant: dominantPollutant,
      last_updated: latestUpdate,
      advisory_english: advisory.english,
      advisory_urdu: advisory.urdu,
      message: message
    });
    
  } catch (error) {
    console.error('Error in /aqi-city:', error.message);
    return res.json({
      success: false,
      message: "Error fetching city AQI data. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`EPA AQI server running on port ${PORT}`);
});