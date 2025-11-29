const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

/**
 * Configure Helmet.js for HTTP security headers
 * Protects against common web vulnerabilities
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts in EJS
        "https://unpkg.com", // Leaflet CDN
        "https://cdnjs.cloudflare.com", // fullPage.js and other libraries
        "https://raw.githubusercontent.com", // Map images
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles
        "https://unpkg.com", // Leaflet CSS
        "https://cdnjs.cloudflare.com", // fullPage.js CSS
        "https://fonts.googleapis.com", // Google Fonts
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "https://raw.githubusercontent.com", // Map markers
        "https://maps.izurvive.com", // Map tiles
      ],
      connectSrc: [
        "'self'",
        "https://unpkg.com", // Allow sourcemap downloads from Leaflet CDN
        "https:",
        "ws://localhost:4310", // Queue API WebSocket connection
        "wss://localhost:4310", // Queue API WebSocket secure connection
        "http://localhost:4310", // Queue API HTTP connection
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com", // Google Fonts
        "https:",
        "data:",
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  crossOriginEmbedderPolicy: false, // Disable if causing issues with external resources
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
});

/**
 * CORS Configuration
 * Restrict which origins can access your API
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000"];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200,
};

/**
 * Rate Limiting Configuration
 * Prevents brute force and DDoS attacks
 */

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for authenticated admin users if needed
    return false;
  },
});

// Stricter rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: "Too many login attempts, please try again after 15 minutes.",
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limiter for password reset or sensitive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 attempts per hour
  message: "Too many attempts, please try again after an hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * MongoDB Sanitization
 * Prevents NoSQL injection attacks
 */
const mongoSanitizeConfig = mongoSanitize({
  replaceWith: "_", // Replace prohibited characters with underscore
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️ Sanitized key detected: ${key} from IP: ${req.ip}`);
  },
});

/**
 * HTTP Parameter Pollution Protection
 * Prevents attacks using duplicate parameters
 */
const hppConfig = hpp({
  whitelist: [
    "guildId",
    "serviceId",
    "type",
    "status",
  ], // Allow duplicate values for these parameters
});

/**
 * Security middleware bundle
 * Apply all security measures in correct order
 */
function applySecurityMiddleware(app) {
  // Trust proxy - Important for rate limiting behind reverse proxy (nginx, etc.)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1); // Trust first proxy
  }

  // 1. Helmet - Set security headers
  app.use(helmetConfig);

  // 2. CORS - Control cross-origin requests
  if (process.env.NODE_ENV === "production") {
    app.use(cors(corsOptions));
  }

  // 3. MongoDB Sanitization - Prevent NoSQL injection
  app.use(mongoSanitizeConfig);

  // 4. HPP - Prevent HTTP parameter pollution
  app.use(hppConfig);

  // 5. Apply rate limiters (applied per route, not globally)
  return {
    apiLimiter,
    authLimiter,
    strictLimiter,
  };
}

/**
 * Session security configuration
 */
const getSessionConfig = (mongoUrl) => {
  const MongoStore = require("connect-mongo");
  const sameSiteSetting = process.env.COOKIE_SAMESITE || "lax"; // OAuth-friendly default

  return {
    secret: process.env.SESSION_SECRET || generateSecureSecret(),
    resave: false,
    saveUninitialized: false,
    name: "sessionId", // Change default name to avoid fingerprinting
    store: MongoStore.create({
      mongoUrl: mongoUrl,
      touchAfter: 24 * 3600, // Lazy session update (seconds)
      crypto: {
        secret: process.env.SESSION_CRYPTO_SECRET || process.env.SESSION_SECRET,
      },
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: sameSiteSetting, // Lax for OAuth redirects; override via COOKIE_SAMESITE if needed
      domain: process.env.COOKIE_DOMAIN || undefined,
    },
    proxy: process.env.NODE_ENV === "production", // Trust proxy in production
  };
};

/**
 * Generate a secure random secret if none provided
 */
function generateSecureSecret() {
  const crypto = require("crypto");
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Security logging middleware
 * Log suspicious activities
 */
function securityLogger(req, res, next) {
  // Log failed authentication attempts
  if (req.path.includes("/auth/") && res.statusCode === 401) {
    console.warn(`⚠️ Failed auth attempt from IP: ${req.ip} - Path: ${req.path}`);
  }

  // Log potential SQL/NoSQL injection attempts
  const suspiciousPatterns = /(\$where|\$ne|\$gt|\$regex|<script|javascript:|onerror=)/i;
  const checkValue = JSON.stringify(req.body) + JSON.stringify(req.query);
  
  if (suspiciousPatterns.test(checkValue)) {
    console.warn(
      `🚨 SECURITY: Suspicious pattern detected from IP: ${req.ip}`,
      `Path: ${req.path}`,
      `Body: ${JSON.stringify(req.body)}`,
      `Query: ${JSON.stringify(req.query)}`
    );
  }

  next();
}

/**
 * Validate environment variables on startup
 */
function validateSecurityConfig() {
  const requiredEnvVars = [
    "SESSION_SECRET",
    "DISCORD_CLIENT_SECRET",
    "MONGO_URI",
  ];

  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    console.error(`❌ SECURITY ERROR: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Warn about insecure configurations
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ALLOWED_ORIGINS) {
      console.warn("⚠️ WARNING: ALLOWED_ORIGINS not set. Defaulting to localhost only.");
    }

    if (process.env.DISCORD_CALLBACK_URL?.includes("localhost")) {
      console.warn("⚠️ WARNING: DISCORD_CALLBACK_URL still set to localhost in production!");
    }

    if (process.env.SESSION_SECRET?.length < 32) {
      console.error("❌ SECURITY ERROR: SESSION_SECRET must be at least 32 characters in production!");
      process.exit(1);
    }
  }

  console.log("✅ Security configuration validated");
}

module.exports = {
  applySecurityMiddleware,
  getSessionConfig,
  securityLogger,
  validateSecurityConfig,
  rateLimiters: {
    apiLimiter,
    authLimiter,
    strictLimiter,
  },
};
