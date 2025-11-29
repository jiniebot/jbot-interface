const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const passport = require("./config/passport");
const path = require("path");
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
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
