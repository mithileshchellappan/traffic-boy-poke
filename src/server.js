#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from 'express';
import cors from 'cors';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@googlemaps/google-maps-services-js";

class TrafficMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "traffic-boy-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize Google Maps client
    this.googleMapsClient = new Client({});

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_live_traffic",
            description: "Get live traffic data between two locations using Google Maps",
            inputSchema: {
              type: "object",
              properties: {
                origin: {
                  type: "string",
                  description: "Origin location (address or 'lat,lng')"
                },
                destination: {
                  type: "string",
                  description: "Destination location (address or 'lat,lng')"
                },
                mode: {
                  type: "string",
                  enum: ["driving", "walking", "bicycling", "transit"],
                  default: "driving",
                  description: "Travel mode"
                }
              },
              required: ["origin", "destination"]
            }
          },
          {
            name: "get_forecast_traffic",
            description: "Get forecast traffic data for future travel times",
            inputSchema: {
              type: "object",
              properties: {
                origin: {
                  type: "string",
                  description: "Origin location (address or 'lat,lng')"
                },
                destination: {
                  type: "string",
                  description: "Destination location (address or 'lat,lng')"
                },
                departure_time: {
                  type: "string",
                  description: "Departure time in ISO format (e.g., '2024-01-15T09:00:00Z') or 'now' for immediate departure"
                },
                mode: {
                  type: "string",
                  enum: ["driving", "walking", "bicycling", "transit"],
                  default: "driving",
                  description: "Travel mode"
                }
              },
              required: ["origin", "destination", "departure_time"]
            }
          },
          {
            name: "get_traffic_comparison",
            description: "Compare current vs forecast traffic for route planning",
            inputSchema: {
              type: "object",
              properties: {
                origin: {
                  type: "string",
                  description: "Origin location (address or 'lat,lng')"
                },
                destination: {
                  type: "string",
                  description: "Destination location (address or 'lat,lng')"
                },
                forecast_hours: {
                  type: "number",
                  description: "Hours from now to check forecast (1-24)",
                  minimum: 1,
                  maximum: 24,
                  default: 1
                },
                mode: {
                  type: "string",
                  enum: ["driving", "walking", "bicycling", "transit"],
                  default: "driving",
                  description: "Travel mode"
                }
              },
              required: ["origin", "destination"]
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_live_traffic":
            return await this.getLiveTraffic(args);
          case "get_forecast_traffic":
            return await this.getForecastTraffic(args);
          case "get_traffic_comparison":
            return await this.getTrafficComparison(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async getLiveTraffic(args) {
    const { origin, destination, mode = "driving" } = args;

    try {
      const response = await this.googleMapsClient.directions({
        params: {
          origin: this.parseLocation(origin),
          destination: this.parseLocation(destination),
          mode: mode,
          departure_time: "now",
          traffic_model: "best_guess",
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (!response.data.routes || response.data.routes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No routes found between the specified locations."
            }
          ]
        };
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      const result = {
        origin: leg.start_address,
        destination: leg.end_address,
        distance: leg.distance.text,
        duration: leg.duration.text,
        duration_in_traffic: leg.duration_in_traffic?.text || "Not available",
        traffic_summary: this.analyzeTrafficConditions(route),
        steps: leg.steps.map(step => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance.text,
          duration: step.duration.text,
          traffic_speed: step.duration_in_traffic ? "Has traffic data" : "No traffic data"
        }))
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Google Maps API error: ${error.message}`);
    }
  }

  async getForecastTraffic(args) {
    const { origin, destination, departure_time, mode = "driving" } = args;

    try {
      const departureTime = departure_time === "now" ? "now" : new Date(departure_time);

      const response = await this.googleMapsClient.directions({
        params: {
          origin: this.parseLocation(origin),
          destination: this.parseLocation(destination),
          mode: mode,
          departure_time: departureTime,
          traffic_model: "pessimistic", // Use pessimistic for worst-case forecast
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (!response.data.routes || response.data.routes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No routes found for the specified time."
            }
          ]
        };
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      const result = {
        departure_time: departure_time,
        origin: leg.start_address,
        destination: leg.end_address,
        forecast_distance: leg.distance.text,
        forecast_duration: leg.duration.text,
        forecast_duration_in_traffic: leg.duration_in_traffic?.text || "Not available",
        traffic_model: "pessimistic (worst-case scenario)",
        confidence_level: "High - Based on historical and real-time data"
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Google Maps API error: ${error.message}`);
    }
  }

  async getTrafficComparison(args) {
    const { origin, destination, forecast_hours = 1, mode = "driving" } = args;

    try {
      // Get current traffic
      const currentResponse = await this.googleMapsClient.directions({
        params: {
          origin: this.parseLocation(origin),
          destination: this.parseLocation(destination),
          mode: mode,
          departure_time: "now",
          traffic_model: "best_guess",
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      // Get forecast traffic
      const forecastTime = new Date();
      forecastTime.setHours(forecastTime.getHours() + forecast_hours);

      const forecastResponse = await this.googleMapsClient.directions({
        params: {
          origin: this.parseLocation(origin),
          destination: this.parseLocation(destination),
          mode: mode,
          departure_time: forecastTime,
          traffic_model: "pessimistic",
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (!currentResponse.data.routes?.[0] || !forecastResponse.data.routes?.[0]) {
        return {
          content: [
            {
              type: "text",
              text: "Unable to get traffic data for one or both time periods."
            }
          ]
        };
      }

      const currentLeg = currentResponse.data.routes[0].legs[0];
      const forecastLeg = forecastResponse.data.routes[0].legs[0];

      const comparison = {
        origin: currentLeg.start_address,
        destination: currentLeg.end_address,
        current_traffic: {
          distance: currentLeg.distance.text,
          duration: currentLeg.duration.text,
          duration_in_traffic: currentLeg.duration_in_traffic?.text || currentLeg.duration.text
        },
        forecast_traffic: {
          hours_ahead: forecast_hours,
          departure_time: forecastTime.toISOString(),
          distance: forecastLeg.distance.text,
          duration: forecastLeg.duration.text,
          duration_in_traffic: forecastLeg.duration_in_traffic?.text || forecastLeg.duration.text
        },
        comparison: {
          time_difference_seconds: this.calculateTimeDifference(
            currentLeg.duration_in_traffic?.value || currentLeg.duration.value,
            forecastLeg.duration_in_traffic?.value || forecastLeg.duration.value
          ),
          recommendation: this.generateRecommendation(currentLeg, forecastLeg, forecast_hours)
        }
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comparison, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Google Maps API error: ${error.message}`);
    }
  }

  parseLocation(location) {
    // Check if it's coordinates (lat,lng format)
    const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return `${coordMatch[1]},${coordMatch[2]}`;
    }
    // Otherwise treat as address
    return location;
  }

  analyzeTrafficConditions(route) {
    // Simple traffic analysis based on route warnings
    const warnings = route.warnings || [];
    if (warnings.length > 0) {
      return `Traffic alerts: ${warnings.join(', ')}`;
    }
    return "No major traffic issues detected";
  }

  calculateTimeDifference(currentSeconds, forecastSeconds) {
    return forecastSeconds - currentSeconds;
  }

  generateRecommendation(currentLeg, forecastLeg, hoursAhead) {
    const currentTime = currentLeg.duration_in_traffic?.value || currentLeg.duration.value;
    const forecastTime = forecastLeg.duration_in_traffic?.value || forecastLeg.duration.value;

    const differenceMinutes = Math.abs((forecastTime - currentTime) / 60);

    if (differenceMinutes < 5) {
      return `Traffic conditions expected to be similar. Safe to proceed as planned.`;
    } else if (forecastTime > currentTime) {
      return `Traffic expected to be ${Math.round(differenceMinutes)} minutes worse in ${hoursAhead} hour(s). Consider leaving earlier or finding an alternative route.`;
    } else {
      return `Traffic expected to be ${Math.round(differenceMinutes)} minutes better in ${hoursAhead} hour(s). Good time to travel!`;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Traffic MCP Server running on stdio");
  }

  async runHTTP(port = 3000) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', message: 'Traffic MCP Server is running' });
    });

    // MCP endpoint - handle both GET (SSE) and POST (JSON-RPC)
    app.post('/mcp', async (req, res) => {
      console.log('MCP POST request received');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      try {
        const request = req.body;
        console.log('MCP JSON-RPC request:', JSON.stringify(request, null, 2));

        // Handle JSON-RPC requests directly without transport
        if (request.method === 'initialize') {
          const protocolVersion = request?.params?.protocolVersion || '2025-06-18';
          const responseBody = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion,
              serverInfo: {
                name: 'traffic-boy-mcp-server',
                version: '1.0.0'
              },
              capabilities: {
                tools: {}
              }
            }
          };
          res.json(responseBody);

        } else if (request.method === 'ping') {
          res.json({
            jsonrpc: '2.0',
            id: request.id,
            result: { ok: true, now: new Date().toISOString() }
          });

        } else if (request.method === 'tools/list') {
          const tools = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [
                {
                  name: 'get_live_traffic',
                  description: 'Get live traffic data between two locations using Google Maps',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      origin: {
                        type: 'string',
                        description: 'Origin location (address or lat,lng)'
                      },
                      destination: {
                        type: 'string', 
                        description: 'Destination location (address or lat,lng)'
                      },
                      mode: {
                        type: 'string',
                        enum: ['driving', 'walking', 'bicycling', 'transit'],
                        default: 'driving',
                        description: 'Travel mode'
                      }
                    },
                    required: ['origin', 'destination']
                  }
                },
                {
                  name: 'get_forecast_traffic',
                  description: 'Get forecast traffic data for future travel times',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      origin: {
                        type: 'string',
                        description: 'Origin location (address or lat,lng)'
                      },
                      destination: {
                        type: 'string',
                        description: 'Destination location (address or lat,lng)'
                      },
                      departure_time: {
                        type: 'string',
                        description: 'Departure time in ISO format or "now"'
                      },
                      mode: {
                        type: 'string',
                        enum: ['driving', 'walking', 'bicycling', 'transit'],
                        default: 'driving',
                        description: 'Travel mode'
                      }
                    },
                    required: ['origin', 'destination', 'departure_time']
                  }
                },
                {
                  name: 'get_traffic_comparison',
                  description: 'Compare current vs forecast traffic for route planning',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      origin: {
                        type: 'string',
                        description: 'Origin location (address or lat,lng)'
                      },
                      destination: {
                        type: 'string',
                        description: 'Destination location (address or lat,lng)'
                      },
                      forecast_hours: {
                        type: 'number',
                        description: 'Hours from now to check forecast (1-24)',
                        minimum: 1,
                        maximum: 24,
                        default: 1
                      },
                      mode: {
                        type: 'string',
                        enum: ['driving', 'walking', 'bicycling', 'transit'],
                        default: 'driving',
                        description: 'Travel mode'
                      }
                    },
                    required: ['origin', 'destination']
                  }
                }
              ]
            }
          };
          res.json(tools);

        } else if (request.method === 'tools/call') {
          const { name, arguments: args } = request.params;
          let result;

          try {
            switch (name) {
              case 'get_live_traffic':
                result = await this.getLiveTraffic(args);
                break;
              case 'get_forecast_traffic':
                result = await this.getForecastTraffic(args);
                break;
              case 'get_traffic_comparison':
                result = await this.getTrafficComparison(args);
                break;
              default:
                throw new Error(`Unknown tool: ${name}`);
            }

            res.json({
              jsonrpc: '2.0',
              id: request.id,
              result: result
            });

          } catch (error) {
            console.error('Tool execution error:', error);
            res.json({
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32603,
                message: `Tool execution failed: ${error.message}`
              }
            });
          }

        } else {
          res.json({
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id: request.id
          });
        }

      } catch (error) {
        console.error('MCP JSON-RPC error:', error);
        res.json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: req.body?.id
        });
      }
    });

    app.get('/mcp', (req, res) => {
      console.log('MCP GET request - SSE not implemented, use POST for JSON-RPC');
      res.status(400).json({ 
        error: 'Use POST method for MCP JSON-RPC requests' 
      });
    });

    app.listen(port, () => {
      console.log(`Traffic MCP Server running on http://localhost:${port}`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`Health check: http://localhost:${port}/health`);
    });
  }
}

// Check for API key
if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error("Error: GOOGLE_MAPS_API_KEY environment variable is required");
  console.error("Get your API key from: https://console.cloud.google.com/google/maps-apis");
  process.exit(1);
}

const server = new TrafficMCPServer();

// Check command line arguments
const mode = process.argv[2]; // 'http' or 'stdio'
const port = process.argv[3] || 3000;

if (mode === 'http') {
  console.log('Starting Traffic MCP Server in HTTP mode...');
  server.runHTTP(port).catch(console.error);
} else {
  console.log('Starting Traffic MCP Server in stdio mode...');
  server.run().catch(console.error);
}
