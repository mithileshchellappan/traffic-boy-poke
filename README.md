<div align="center">
  <img width="120" height="120" alt="image" src="https://github.com/user-attachments/assets/d71712ba-cd3f-42a1-84b2-34f5e07aa3ba" />
  <h1><b>Traffic Boy - Poke MCP Server</b></h1>
  <p><em>Building my First Ever MCP Server <a href="https://x.com/notagodzilla/status/1967201612407153011">in under 3 hours</a> for the <a href="https://poke.com"> Poke MCP Challenge</a>.</em></p>
</div>


A Model Context Protocol (MCP) server that provides live and forecast traffic data using Google Maps API.

## ✨ Features

- **Live Traffic Data**: Get real-time traffic conditions between any two locations
- **Traffic Forecasting**: Predict future travel times with traffic considerations
- **Traffic Comparison**: Compare current vs. forecasted traffic for route planning
- **Flexible Location Input**: Supports both addresses and latitude/longitude coordinates
- **Multiple Travel Modes**: Driving, walking, bicycling, and transit options

## 🚀 Planned Features
- [ ] Search places so you can just say "Apple Store, Bengaluru" and it'll get the correct location
- [ ] Access Saved places on Google Maps. Requires a setup to get and store user's oauth tokens.
- [ ] Access Live Location. 

## 🛠️ Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Directions API
  - Geocoding API
  - Distance Matrix API

### 2. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the required APIs mentioned above
4. Create credentials (API Key)
5. Optionally restrict the API key to your domain for security

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Environment Variable

```bash
export GOOGLE_MAPS_API_KEY="your-api-key-here"
```

Or create a `.env` file:
```bash
GOOGLE_MAPS_API_KEY=your-api-key-here
```

### 5. Run the Server

```bash
npm start
```

## 🎯 Available Tools

### `get_live_traffic`
Get current traffic conditions between two locations.

**Parameters:**
- `origin`: Origin location (address like "New York, NY" or coordinates "40.7128,-74.0060")
- `destination`: Destination location (same format as origin)
- `mode`: Travel mode - "driving", "walking", "bicycling", or "transit" (default: "driving")

### `get_forecast_traffic`
Get forecasted traffic conditions for a specific departure time.

**Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `departure_time`: ISO timestamp (e.g., "2024-01-15T09:00:00Z") or "now"
- `mode`: Travel mode (default: "driving")

### `get_traffic_comparison`
Compare current traffic vs. forecasted traffic for decision making.

**Parameters:**
- `origin`: Origin location
- `destination`: Destination location
- `forecast_hours`: Hours ahead to check (1-24, default: 1)
- `mode`: Travel mode (default: "driving")

## 📱 Integration with Poke

### 1. Add to Poke

1. Go to [Poke Settings > Connections > Integrations](https://poke.com/settings/connections/integrations/new)
2. Add your MCP server endpoint
3. Use the provided configuration in `poke-config.json`

### 2. Create Automations

Here are some example automations you can create:

#### Daily Commute Check
- **Trigger**: Schedule (8:00 AM weekdays)
- **Action**: Get live traffic from home to office
- **Notification**: Send email/SMS with travel time

#### Smart Departure Time
- **Trigger**: Calendar event starting soon
- **Action**: Check traffic and suggest optimal departure time
- **Smart Logic**: If traffic is bad, send reminder 15 minutes early

#### Traffic Alert System
- **Trigger**: Significant traffic delay detected
- **Action**: Notify with alternative routes
- **Integration**: Connect with calendar for rescheduling

## 📝 Example Usage with Poke 🌴
Ask Poke to remember your favourite places like:
- "Remember 323 Merlin Dr California as my Home"
- "Remember Apple Park, Cupertino as my Work"

Ask Poke to remember your routine and set automation to use Traffic Boy like:
- "I leave to work on weekdays at 9 AM, be sure to check for traffic at that time"
- "I go to the gym at 6 PM from work at weekdays, and at 5 PM on weekends directly from home, be sure to check for traffic at that time"

<img width="1585" height="413" alt="image" src="https://github.com/user-attachments/assets/866f69fb-19a9-4613-ad27-e79e0f36bba7" />





## 📝 Example Usage

```javascript
// Get live traffic
{
  "tool": "get_live_traffic",
  "origin": "Times Square, New York, NY",
  "destination": "JFK Airport, New York, NY",
  "mode": "driving"
}

// Get forecast for tomorrow morning
{
  "tool": "get_forecast_traffic",
  "origin": "40.7589,-73.9851",
  "destination": "40.6413,-73.7781",
  "departure_time": "2024-01-15T08:00:00Z"
}

// Compare current vs future traffic
{
  "tool": "get_traffic_comparison",
  "origin": "Boston, MA",
  "destination": "Providence, RI",
  "forecast_hours": 2
}
```

## 🔧 Configuration

The server uses the following configuration:

- **Port**: Runs on stdio (standard MCP protocol)
- **API Key**: Required via `GOOGLE_MAPS_API_KEY` environment variable
- **Traffic Model**: Uses "best_guess" for current, "pessimistic" for forecasts
- **Supported Modes**: driving, walking, bicycling, transit

## 🚀 Deployment

For production deployment:

1. Set up your Google Maps API key securely
2. Deploy to a server with Node.js support
3. Configure Poke to connect to your MCP server endpoint
4. Monitor API usage and costs

## 📊 API Limits & Costs

- Google Maps has generous free tier (up to $200/month credit)
- Directions API: 40,000 requests/month free
- Monitor usage in Google Cloud Console
- Costs scale with usage beyond free tier

## 🤝 Contributing

Feel free to enhance this MCP server with:
- Additional traffic data sources
- Route optimization algorithms
- Integration with other mapping services
- Advanced analytics and predictions

## 📄 License

MIT License

---
