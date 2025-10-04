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