const { body, param, query, validationResult } = require("express-validator");

/**
 * Validation error handler middleware
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn(`⚠️ Validation failed from IP: ${req.ip}`, errors.array());
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

/**
 * Validation rules for common fields
 */
const validators = {
  // MongoDB ObjectID validation
  objectId: param("id")
    .isMongoId()
    .withMessage("Invalid ID format"),

  // Guild ID validation
  guildId: [
    body("guildId")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 17, max: 20 })
      .withMessage("Invalid guild ID format"),
    query("guildId")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 17, max: 20 })
      .withMessage("Invalid guild ID format"),
  ],

  // Service ID validation
  serviceId: [
    body("serviceId")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Invalid service ID format"),
    query("serviceId")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("Invalid service ID format"),
  ],

  // User ID validation (Discord ID)
  userId: [
    body("userId")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 17, max: 20 })
      .withMessage("Invalid user ID format"),
  ],

  // Coordinates validation
  coordinates: [
    body("x")
      .optional()
      .isFloat({ min: 0, max: 15360 })
      .withMessage("X coordinate must be between 0 and 15360"),
    body("z")
      .optional()
      .isFloat({ min: 0, max: 15360 })
      .withMessage("Z coordinate must be between 0 and 15360"),
    body("y")
      .optional()
      .isFloat({ min: 0, max: 1000 })
      .withMessage("Y coordinate must be between 0 and 1000"),
  ],

  // Base name validation
  baseName: body("baseName")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9\s-_]+$/)
    .withMessage("Base name can only contain letters, numbers, spaces, hyphens, and underscores"),

  // Zone name validation
  zoneName: body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9\s-_]+$/)
    .withMessage("Zone name can only contain letters, numbers, spaces, hyphens, and underscores"),

  // Faction name validation
  factionName: body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9\s-_]+$/)
    .withMessage("Faction name can only contain letters, numbers, spaces, hyphens, and underscores"),

  // Range validation
  range: body("range")
    .optional()
    .isInt({ min: 1, max: 5000 })
    .withMessage("Range must be between 1 and 5000 meters"),

  // Boolean validation
  isActive: body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),

  // Pagination validation
  pagination: [
    query("page")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Page must be between 1 and 1000"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],

  // Sort validation
  sort: query("sort")
    .optional()
    .isIn(["createdAt", "-createdAt", "name", "-name", "lastActive", "-lastActive"])
    .withMessage("Invalid sort field"),
};

/**
 * Sanitization middleware
 * Additional layer of protection beyond mongo-sanitize
 */
const sanitizeInput = (req, res, next) => {
  // Remove any potential MongoDB operators from nested objects
  const sanitize = (obj) => {
    if (typeof obj !== "object" || obj === null) return obj;
    
    const cleaned = {};
    for (let key in obj) {
      // Remove keys that start with $ or contain dots
      if (!key.startsWith("$") && !key.includes(".")) {
        cleaned[key] = typeof obj[key] === "object" ? sanitize(obj[key]) : obj[key];
      } else {
        console.warn(`⚠️ Removed suspicious key: ${key} from IP: ${req.ip}`);
      }
    }
    return cleaned;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

/**
 * Authentication check middleware
 */
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

/**
 * Guild and Service scope validation
 */
const requireScope = (req, res, next) => {
  if (!req.session.guildId || !req.session.serviceId) {
    return res.status(400).json({
      error: "Missing guild or service context",
      message: "Please select a guild and service first",
    });
  }
  next();
};

/**
 * Combined auth and scope check
 */
const requireAuthAndScope = [requireAuth, requireScope];

/**
 * Role-based access control middleware
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const Globals = require("../schemas/globals/Globals");
      
      const guild = await Globals.findOne({
        guildid: req.session.guildId,
        "services.ServerInfo.nitrado_service_id": req.session.serviceId,
      });

      if (!guild) {
        return res.status(403).json({ error: "Access denied" });
      }

      const service = guild.services.find(
        (s) => s.ServerInfo?.nitrado_service_id === req.session.serviceId
      );

      const isOwner = service.ServerInfo?.ownerid === req.user.id;
      const isAuthorized = service.ServerInfo?.authorizedUsers?.includes(req.user.id);

      if (!isOwner && !isAuthorized) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Store role in request for further use
      req.userRole = isOwner ? "owner" : "authorized";
      next();
    } catch (err) {
      console.error("❌ Role check error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

module.exports = {
  handleValidationErrors,
  validators,
  sanitizeInput,
  requireAuth,
  requireScope,
  requireAuthAndScope,
  requireRole,
};
