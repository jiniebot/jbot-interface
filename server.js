const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const passport = require("./config/passport");
const path = require("path");
const { createProxyMiddleware } = require('http-proxy-middleware');
require("dotenv").config();

// Import security configuration
const {
  applySecurityMiddleware,
  getSessionConfig,
  securityLogger,
  validateSecurityConfig,
  rateLimiters,
} = require("./config/security");

// Validate security configuration before starting
validateSecurityConfig();

const app = express();

// Apply security middleware (helmet, CORS, sanitization, etc.)
const { apiLimiter, authLimiter, strictLimiter } = applySecurityMiddleware(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10kb" })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Security logging middleware
app.use(securityLogger);

// Build mongoose connection options with sensible defaults and env-based overrides
const mongooseOptions = {
  // modern parser and topology engine
  //useNewUrlParser: true,
  // useUnifiedTopology: true,
};

// TLS/SSL behavior can be controlled via environment variables.
// - MONGO_TLS (true/false) enables or disables TLS explicitly
// - MONGO_TLS_ALLOW_INVALID (true/false) allows invalid/self-signed certs (use only for testing)
// - MONGO_TLS_CA_FILE (path) points to a CA bundle file for validating server certs
if (process.env.MONGO_TLS === "false") {
  mongooseOptions.tls = false;
} else if (process.env.MONGO_TLS === "true") {
  mongooseOptions.tls = true;
}

if (process.env.MONGO_TLS_ALLOW_INVALID === "true") {
  // Allows self-signed or otherwise invalid certs - not recommended for production
  mongooseOptions.tlsAllowInvalidCertificates = true;
}

if (process.env.MONGO_TLS_CA_FILE) {
  // Provide CA file path if you need to validate against a custom CA
  mongooseOptions.tlsCAFile = process.env.MONGO_TLS_CA_FILE;
}

mongoose.connect(process.env.MONGO_URI, mongooseOptions)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => {
    // Improved error output to help debug TLS/SSL issues when switching DBs
    console.error("❌ MongoDB Connection Error:", err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    // Helpful troubleshooting hints
    console.error(
      `Mongo connection string: ${process.env.MONGO_URI ? '[provided]' : '[not set]'}; MONGO_TLS=${process.env.MONGO_TLS}; MONGO_TLS_ALLOW_INVALID=${process.env.MONGO_TLS_ALLOW_INVALID}; MONGO_TLS_CA_FILE=${process.env.MONGO_TLS_CA_FILE || '[none]'}\n` +
      'If you see a TLS/SSL handshake error, check whether the target MongoDB requires TLS (Atlas typically does),\n' +
      'ensure your connection string (mongodb+srv vs mongodb://) is correct, and that node/OpenSSL supports the required TLS version.\n' +
      'For testing only, you can set MONGO_TLS_ALLOW_INVALID=true to bypass certificate validation (NOT recommended in prod).'
    );
  });

// Use secure session configuration
app.use(session(getSessionConfig(process.env.MONGO_URI)));

app.use(passport.initialize());
app.use(passport.session());

// Routes with rate limiting
app.use("/auth", authLimiter, require("./routes/auth")); // Apply strict rate limiting to auth routes
app.use("/selectGuildService", require("./routes/selectGuildService"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/settings", require("./routes/settings"));
app.use("/spawner-queue", require("./routes/queueManager"));

app.use((req, res, next) => {
  //console.log("🛠️ Current Session Data:", req.session);
  next();
});

// Landing page
app.get("/", (req, res) => {
  // Redirect to dashboard if already logged in
  if (req.isAuthenticated() && req.session.guildId && req.session.serviceId) {
    return res.redirect("/dashboard");
  }
  res.render("landing", { user: req.user });
});

app.use(express.static("public"));

app.use("/tiles", express.static(path.join(__dirname, "public/js/map/tiles")));

// Authenticated WebSocket proxy for Queue API
// This ensures all requests are validated and adds API key authentication
const QUEUE_API_URL = process.env.QUEUE_API_URL || 'http://localhost:4310';
const QUEUE_API_KEY = process.env.DASHBOARD_API_KEY || process.env.API_KEY;
const httpProxy = require('http-proxy');

// Create raw HTTP proxy for manual WebSocket handling
const rawProxy = httpProxy.createProxyServer({
  target: QUEUE_API_URL,
  ws: true,
  changeOrigin: true
});

// Error handlers for the raw proxy
rawProxy.on('error', (err, req, res) => {
  console.error('[Raw Proxy] HTTP Error:', err.message, err.code);
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Queue API unavailable' }));
  } else if (res && res.end) {
    // WebSocket error - just close the socket
    res.end();
  }
});

rawProxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
  console.log('[Raw Proxy] WebSocket upgrade in progress');
  console.log('[Raw Proxy] Target:', QUEUE_API_URL);
  console.log('[Raw Proxy] Original URL:', req.url);
  // Add API key header
  if (QUEUE_API_KEY) {
    proxyReq.setHeader('X-API-Key', QUEUE_API_KEY);
    console.log('[Raw Proxy] ✓ Added X-API-Key to WebSocket request');
  } else {
    console.error('[Raw Proxy] ⚠️ No API key available!');
  }
});

// Create the proxy middleware for HTTP requests
const queueApiProxy = createProxyMiddleware({
  target: QUEUE_API_URL,
  changeOrigin: true,
  ws: false, // We'll handle WebSocket separately
  pathRewrite: {
    '^/queue-api': '' // Remove /queue-api prefix when forwarding
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add API key to all forwarded requests for backend authentication
    if (QUEUE_API_KEY) {
      proxyReq.setHeader('X-API-Key', QUEUE_API_KEY);
    }
    console.log(`[Proxy] ${req.method} ${req.url} -> ${QUEUE_API_URL}${req.url.replace('/queue-api', '')}`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy] HTTP Error:', err.message);
    if (res && res.writeHead) {
      res.status(502).json({ error: 'Queue API unavailable' });
    }
  },
  logLevel: 'warn'
});

// Apply authentication check for HTTP requests only
// WebSocket upgrades are authenticated via session cookie in the initial handshake
app.use('/queue-api', (req, res, next) => {
  // Skip auth check for WebSocket upgrade requests (socket.io handles auth via cookies)
  if (req.headers.upgrade === 'websocket') {
    console.log('[Middleware] WebSocket upgrade detected, adding API key');
    // Add API key for backend authentication
    if (QUEUE_API_KEY) {
      req.headers['x-api-key'] = QUEUE_API_KEY;
    }
    return next();
  }
  
  // Validate user is authenticated for HTTP requests
  if (!req.isAuthenticated() || !req.session.guildId || !req.session.serviceId) {
    return res.status(401).json({ error: 'Unauthorized - Authentication required' });
  }
  next();
}, queueApiProxy);

// API Routes with rate limiting
app.use("/api", apiLimiter);
app.use("/api/bounties", require("./routes/api/bounties"));
app.use("/api/events", require("./routes/api/events"));
app.use("/api/factions", require("./routes/api/factions"));
app.use("/api/zones", require("./routes/api/zones"));
app.use("/api/raids", require("./routes/api/raids"));
app.use("/api/quests", require("./routes/api/quests"));
app.use("/api/shop", require("./routes/api/shop"));
app.use("/api/spawner-queue", require("./routes/api/spawner-queue"));
app.use("/api/queue-manager", require("./routes/api/queueManager"));
app.use("/api/logs", require("./routes/api/logs"));
app.use("/api", require("./routes/api")); // Legacy routes

app.use("/css", express.static(path.join(__dirname, "public/css")));

app.get("/debug-session", (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    sessionGuildId: req.session.guildId,
    sessionServiceId: req.session.serviceId,
    sessionUser: req.user
  });
});

// Debug endpoint to check Globals data
app.get("/debug-globals", async (req, res) => {
  try {
    const Globals = require("./schemas/globals/Globals");
    const allGlobals = await Globals.find({}).lean();

    res.json({
      count: allGlobals.length,
      globals: allGlobals,
      userId: req.user?.id,
      userGuilds: req.user?.availableGuilds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

// Handle WebSocket upgrades for the proxy
server.on('upgrade', (req, socket, head) => {
  console.log(`[Upgrade] Request URL: ${req.url}`);
  
  if (req.url.startsWith('/queue-api')) {
    console.log(`[Upgrade] Processing WebSocket upgrade for queue-api`);
    
    // Rewrite the URL to remove /queue-api prefix
    const targetUrl = req.url.replace(/^\/queue-api/, '');
    console.log(`[Upgrade] Rewriting URL: ${req.url} -> ${targetUrl}`);
    req.url = targetUrl;
    
    // Add API key header before proxying
    if (QUEUE_API_KEY) {
      req.headers['x-api-key'] = QUEUE_API_KEY;
      console.log('[Upgrade] ✓ Added X-API-Key header');
    } else {
      console.error('[Upgrade] ⚠️ WARNING: No API key available!');
    }
    
    // Use raw proxy for WebSocket upgrade
    try {
      console.log(`[Upgrade] Proxying to: ${QUEUE_API_URL}${req.url}`);
      rawProxy.ws(req, socket, head);
      console.log('[Upgrade] ✓ WebSocket proxy initiated');
    } catch (err) {
      console.error('[Upgrade] ❌ Failed to initiate WebSocket proxy:', err.message, err.stack);
      socket.destroy();
    }
  } else {
    console.log(`[Upgrade] ❌ Rejected non-queue-api upgrade: ${req.url}`);
    socket.destroy();
  }
});
