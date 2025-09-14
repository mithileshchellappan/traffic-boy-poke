#!/usr/bin/env node

// Simple test script to verify the MCP server setup
// Run with: node test-server.js

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { spawn } from 'child_process';

console.log('🚗 Testing Traffic Boy MCP Server...\n');

// Test data
const testRequests = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  },
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'get_live_traffic',
      arguments: {
        origin: 'New York, NY',
        destination: 'Boston, MA',
        mode: 'driving'
      }
    }
  }
];

async function testServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting MCP server...');

    const server = spawn('node', ['src/server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY }
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Server started successfully');
        console.log('📝 Server output:', output.substring(0, 200) + '...');
        resolve();
      } else {
        console.error('❌ Server failed to start');
        console.error('Error:', errorOutput);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Give server time to start
    setTimeout(() => {
      server.kill();
    }, 3000);
  });
}

async function main() {
  try {
    // Check if API key is set
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.log('⚠️  GOOGLE_MAPS_API_KEY not set');
      console.log('Please set your Google Maps API key:');
      console.log('export GOOGLE_MAPS_API_KEY="your-api-key-here"');
      console.log('\nSkipping live API test...\n');
    } else {
      console.log('✅ GOOGLE_MAPS_API_KEY is set');
    }

    // Test server startup
    await testServer();

    console.log('\n🎉 Basic server test completed!');
    console.log('\nNext steps:');
    console.log('1. Set your GOOGLE_MAPS_API_KEY');
    console.log('2. Run: npm start');
    console.log('3. Configure Poke to use this MCP server');
    console.log('4. Create your traffic monitoring automations!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
