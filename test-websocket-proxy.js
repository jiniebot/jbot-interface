#!/usr/bin/env node
/**
 * WebSocket Proxy Diagnostic Tool
 * Tests WebSocket connections through the proxy setup
 */

const io = require('socket.io-client');

const PROXY_URL = process.argv[2] || 'http://localhost:3000';
const API_KEY = process.env.DASHBOARD_API_KEY || process.env.API_KEY;

console.log('🔍 WebSocket Proxy Diagnostic');
console.log('================================');
console.log(`Proxy URL: ${PROXY_URL}`);
console.log(`API Key: ${API_KEY ? '✓ Set' : '✗ Not set'}`);
console.log('');

// Test direct connection to Queue API
console.log('1️⃣ Testing direct connection to Queue API...');
const directSocket = io('http://localhost:4310', {
  transports: ['websocket'],
  extraHeaders: {
    'X-API-Key': API_KEY
  }
});

directSocket.on('connect', () => {
  console.log('✅ Direct connection successful');
  directSocket.disconnect();
  
  // Test proxy connection
  console.log('');
  console.log('2️⃣ Testing proxy connection...');
  const proxySocket = io(PROXY_URL, {
    path: '/queue-api/socket.io/',
    transports: ['websocket'],
    reconnection: false
  });
  
  proxySocket.on('connect', () => {
    console.log('✅ Proxy connection successful');
    proxySocket.disconnect();
    process.exit(0);
  });
  
  proxySocket.on('connect_error', (err) => {
    console.log('❌ Proxy connection failed:', err.message);
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('   - Check that server.js proxy middleware is configured correctly');
    console.log('   - Verify QUEUE_API_URL environment variable');
    console.log('   - Check that API key is being added in upgrade handler');
    console.log('   - Review server logs: pm2 logs');
    process.exit(1);
  });
});

directSocket.on('connect_error', (err) => {
  console.log('❌ Direct connection failed:', err.message);
  console.log('');
  console.log('💡 Possible issues:');
  console.log('   - Queue API server not running (check: pm2 list)');
  console.log('   - API key mismatch');
  console.log('   - Port 4310 not accessible');
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏱️ Timeout - no response from server');
  process.exit(1);
}, 10000);
