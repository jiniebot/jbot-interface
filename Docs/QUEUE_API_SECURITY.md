# Queue API Security Configuration

## Overview

The Queue API handles sensitive Discord bot operations and server file management. This document outlines the security architecture and deployment steps.

## Architecture

```
Internet → Frontend Droplet (HTTPS) → Authenticated Proxy → Backend Droplet (HTTP on private network)
         └─ User Authentication                            └─ API Key Authentication
         └─ Session Validation                             └─ Queue API Server
```

### Security Layers

1. **User Authentication** - Frontend validates Discord OAuth session
2. **Proxy Authorization** - Only authenticated users can reach proxy
3. **API Key Authentication** - Backend validates API key on all requests
4. **Network Isolation** - Backend only accessible via private network
5. **Firewall Rules** - Port 4310 blocked from external access

## Deployment Steps

### 1. Generate API Key

On your local machine or frontend droplet:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy this key - you'll use it on BOTH droplets.

### 2. Frontend Droplet Configuration

Edit `.env` file:

```bash
# Queue API Connection
QUEUE_API_URL=http://10.108.0.2:4310  # Backend's PRIVATE IP
DASHBOARD_API_KEY=<your-generated-key>
API_KEY=<your-generated-key>
```

### 3. Backend Droplet Configuration

Edit `.env` file:

```bash
# Queue API Server Settings
API_HOST=0.0.0.0  # Listen on all interfaces
API_PORT=4310
DASHBOARD_API_KEY=<same-key-as-frontend>
API_KEY=<same-key-as-frontend>

# Discord Bot Token
TOKEN=<your-discord-bot-token>

# Database
MONGO_URI=<your-mongodb-connection-string>
```

### 4. Configure Backend Firewall

**CRITICAL**: Restrict port 4310 to private network only.

```bash
# On backend droplet
# Allow from frontend's private IP only
sudo ufw allow from 10.108.0.3 to any port 4310

# Verify rule is active
sudo ufw status numbered

# Should show something like:
# [X] 4310       ALLOW IN    10.108.0.3
```

### 5. Verify Backend is NOT Publicly Accessible

From your LOCAL machine (NOT the droplets):

```bash
# This should FAIL or timeout - that's GOOD!
curl http://<backend-public-ip>:4310/health

# This should also FAIL - that's GOOD!
telnet <backend-public-ip> 4310
```

If these succeed, your backend is publicly exposed! Go back to step 4.

### 6. Verify Private Network Works

From frontend droplet:

```bash
# This SHOULD succeed
curl http://10.108.0.2:4310/health

# Should return: {"status":"ok"}
```

### 7. Start Services

```bash
# On backend droplet
pm2 start references/queueApiServer.js --name queue-api

# On frontend droplet
pm2 restart server.js
```

### 8. Test WebSocket Connection

1. Open your web application in browser
2. Navigate to spawner queue page
3. Open browser console (F12)
4. Look for these messages:

```
📡 Initializing Socket.io connection to Queue API...
📡 Connecting to Queue API via proxy at: /queue-api
📡 Socket connected to Queue API: <socket-id>
📡 Joined room: <guild>-<service>
```

## Security Checklist

- [ ] API key generated with crypto.randomBytes (at least 32 bytes)
- [ ] Same API key configured on both droplets
- [ ] Backend QUEUE_API_URL uses private IP (10.x.x.x)
- [ ] Backend API_HOST set to 0.0.0.0
- [ ] UFW firewall configured on backend
- [ ] Port 4310 only allows frontend's private IP
- [ ] Public access to port 4310 verified as BLOCKED
- [ ] Private network access verified as WORKING
- [ ] WebSocket connection working through proxy
- [ ] Both services running under PM2

## Troubleshooting

### "xhr poll error" or "websocket error"

**Symptoms**: Browser console shows connection errors

**Check**:
1. Backend service is running: `pm2 list` on backend droplet
2. Backend is listening: `sudo netstat -tulpn | grep 4310` on backend
3. Firewall allows frontend: `sudo ufw status` on backend
4. Can curl from frontend: `curl http://10.108.0.2:4310/health` from frontend droplet

### "401 Unauthorized"

**Symptoms**: API requests return 401

**Check**:
1. API keys match on both droplets
2. API key is not empty or default value
3. Check logs: `pm2 logs queue-api` for authentication errors

### "502 Queue API unavailable"

**Symptoms**: Proxy returns 502 error

**Check**:
1. Backend service is running
2. QUEUE_API_URL is correct in frontend .env
3. Private network connectivity works
4. Backend is not overloaded

## Additional Security Recommendations

### 1. Monitor API Access

Add logging middleware to track all Queue API access:

```javascript
// In queueApiServer.js
function logAccess(req) {
  console.log(`[Access] ${new Date().toISOString()} - ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
}
```

### 2. Rate Limiting

Already implemented in `queueApiServer.js`:
- Process queue throttled to once per 5 minutes per service
- Prevents abuse and server overload

### 3. Regular Security Audits

```bash
# Check for vulnerable dependencies
npm audit

# Update dependencies
npm audit fix

# Review firewall rules monthly
sudo ufw status numbered
```

### 4. Backup and Recovery

- Keep `.env` files backed up securely (NOT in git)
- Document private IPs in secure location
- Test failover procedures regularly

## Network Diagram

```
┌─────────────────────────────────────┐
│   Internet (HTTPS Traffic)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Frontend Droplet (10.108.0.3)      │
│  ├─ Nginx/Apache (443)               │
│  ├─ Node.js Server (3000)            │
│  │  ├─ Session Auth                  │
│  │  └─ Proxy Middleware (/queue-api)│
│  └─ PM2 Process Manager              │
└────────────┬────────────────────────┘
             │ Private Network
             │ (10.x.x.x)
             ▼
┌─────────────────────────────────────┐
│  Backend Droplet (10.108.0.2)       │
│  ├─ Queue API Server (4310)          │
│  │  └─ API Key Auth                  │
│  ├─ Discord Bot Process              │
│  └─ UFW Firewall (4310 restricted)  │
└─────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  MongoDB Atlas / External DB         │
└─────────────────────────────────────┘
```

## Emergency Procedures

### Suspected API Key Compromise

1. Generate new API key immediately
2. Update both droplets' .env files
3. Restart both services
4. Review access logs for suspicious activity
5. Consider rotating Discord bot token if necessary

### Unauthorized Access Detected

1. Block suspicious IPs at firewall level
2. Review and tighten UFW rules
3. Check for exposed ports: `sudo nmap -sT -O localhost`
4. Verify .env files have correct permissions: `chmod 600 .env`
5. Audit recent queue operations and file changes

## Support

For security concerns or questions, refer to:
- Main security documentation: `/Docs/SECURITY.md`
- Implementation status: `/Docs/SECURITY_IMPLEMENTATION_SUMMARY.md`
- Quick reference: `/Docs/SECURITY_QUICK_REFERENCE.md`
