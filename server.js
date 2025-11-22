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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Use secure session configuration
app.use(session(getSessionConfig(process.env.MONGO_URI)));

app.use(passport.initialize());
app.use(passport.session());

// Routes with rate limiting
app.use("/auth", authLimiter, require("./routes/auth")); // Apply strict rate limiting to auth routes
app.use("/selectGuildService", require("./routes/selectGuildService"));
app.use("/dashboard", require("./routes/dashboard"));

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




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
