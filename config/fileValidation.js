/**
 * File Upload Validation for DayZ JSON Files
 * Provides secure validation for JSON file uploads including:
 * - Object spawner files
 * - PRA (Player Restriction Area) files
 * - Spawn gear preset files
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max file size
const ALLOWED_MIME_TYPES = ['application/json', 'text/plain'];
const MAX_JSON_DEPTH = 10;

/**
 * Validates basic file properties
 * @param {Object} file - Multer file object
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateFileBasics(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file extension
  if (!file.originalname.toLowerCase().endsWith('.json')) {
    return { valid: false, error: 'Only .json files are allowed' };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Must be JSON.' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  // Basic filename sanitization check
  const filename = file.originalname;
  const dangerousPatterns = [
    /\.\./,           // Directory traversal
    /[<>:"|?*]/,      // Invalid filename characters
    /[\x00-\x1f]/,    // Control characters
    /^[.\s]/,         // Starting with dot or space
    /[.\s]$/          // Ending with dot or space
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(filename)) {
      return { valid: false, error: 'Invalid filename format' };
    }
  }

  return { valid: true };
}

/**
 * Checks JSON depth to prevent deeply nested structures
 * @param {*} obj - Object to check
 * @param {number} depth - Current depth
 * @returns {number} Maximum depth found
 */
function getJsonDepth(obj, depth = 0) {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (obj === null || typeof obj !== 'object') return depth;
  
  if (Array.isArray(obj)) {
    let maxDepth = depth;
    for (const item of obj) {
      maxDepth = Math.max(maxDepth, getJsonDepth(item, depth + 1));
    }
    return maxDepth;
  }
  
  let maxDepth = depth;
  for (const value of Object.values(obj)) {
    maxDepth = Math.max(maxDepth, getJsonDepth(value, depth + 1));
  }
  return maxDepth;
}

/**
 * Validates JSON structure (not too deep, no circular refs)
 * @param {Object} data - Parsed JSON data
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateJsonStructure(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object' };
  }

  // Check JSON depth
  const depth = getJsonDepth(data);
  if (depth > MAX_JSON_DEPTH) {
    return { valid: false, error: 'JSON structure too deeply nested' };
  }

  return { valid: true };
}

/**
 * Validates a PRA (Player Restriction Area) file
 * @param {Object} data - Parsed JSON data
 * @returns {Object} { valid: boolean, error?: string }
 */
function validatePRAFile(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object' };
  }

  // Check required fields
  if (typeof data.areaName !== 'string') {
    return { valid: false, error: "Missing or invalid 'areaName' field" };
  }

  // PRABoxes must be an array (can be empty)
  if (!Array.isArray(data.PRABoxes)) {
    return { valid: false, error: "Missing or invalid 'PRABoxes' field (must be an array)" };
  }

  // PRAPolygons must be an array if present (optional but if present must be valid)
  if (data.PRAPolygons !== undefined && !Array.isArray(data.PRAPolygons)) {
    return { valid: false, error: "'PRAPolygons' must be an array" };
  }

  // Validate PRABoxes structure: array of arrays with 3 elements [size, rotation, position]
  for (let i = 0; i < data.PRABoxes.length; i++) {
    const box = data.PRABoxes[i];
    if (!Array.isArray(box) || box.length !== 3) {
      return { 
        valid: false, 
        error: `PRABoxes[${i}] must be an array with 3 elements [size, rotation, position]` 
      };
    }
    
    // Each element should be an array of 3 numbers
    for (let j = 0; j < 3; j++) {
      if (!Array.isArray(box[j]) || box[j].length !== 3) {
        return { 
          valid: false, 
          error: `PRABoxes[${i}][${j}] must be an array of 3 numbers` 
        };
      }
      if (!box[j].every(val => typeof val === 'number' && !isNaN(val))) {
        return { 
          valid: false, 
          error: `PRABoxes[${i}][${j}] contains non-numeric values` 
        };
      }
    }
  }

  // Validate PRAPolygons structure if present: array of polygons (array of coordinate pairs)
  if (data.PRAPolygons) {
    for (let i = 0; i < data.PRAPolygons.length; i++) {
      const polygon = data.PRAPolygons[i];
      if (!Array.isArray(polygon) || polygon.length < 3) {
        return { 
          valid: false, 
          error: `PRAPolygons[${i}] must be an array with at least 3 coordinate pairs` 
        };
      }

      for (let j = 0; j < polygon.length; j++) {
        const point = polygon[j];
        if (!Array.isArray(point) || point.length !== 2) {
          return { 
            valid: false, 
            error: `PRAPolygons[${i}][${j}] must be an array of 2 numbers [x, z]` 
          };
        }
        if (!point.every(val => typeof val === 'number' && !isNaN(val))) {
          return { 
            valid: false, 
            error: `PRAPolygons[${i}][${j}] contains non-numeric values` 
          };
        }
      }
    }
  }

  // Validate safePositions3D: array of [x, y, z] coordinates
  if (!Array.isArray(data.safePositions3D)) {
    return { valid: false, error: "Missing or invalid 'safePositions3D' field (must be an array)" };
  }

  for (let i = 0; i < data.safePositions3D.length; i++) {
    const pos = data.safePositions3D[i];
    if (!Array.isArray(pos) || pos.length !== 3) {
      return { 
        valid: false, 
        error: `safePositions3D[${i}] must be an array of 3 numbers [x, y, z]` 
      };
    }
    if (!pos.every(val => typeof val === 'number' && !isNaN(val))) {
      return { 
        valid: false, 
        error: `safePositions3D[${i}] contains non-numeric values` 
      };
    }
  }

  // Validate safePositions2D if present (optional field)
  if (data.safePositions2D !== undefined) {
    if (!Array.isArray(data.safePositions2D)) {
      return { valid: false, error: "'safePositions2D' must be an array" };
    }

    for (let i = 0; i < data.safePositions2D.length; i++) {
      const pos = data.safePositions2D[i];
      if (!Array.isArray(pos) || pos.length !== 2) {
        return { 
          valid: false, 
          error: `safePositions2D[${i}] must be an array of 2 numbers [x, z]` 
        };
      }
      if (!pos.every(val => typeof val === 'number' && !isNaN(val))) {
        return { 
          valid: false, 
          error: `safePositions2D[${i}] contains non-numeric values` 
        };
      }
    }
  }

  // Must have at least one restriction type
  if (data.PRABoxes.length === 0 && (!data.PRAPolygons || data.PRAPolygons.length === 0)) {
    return { 
      valid: false, 
      error: 'PRA file must have at least one PRABox or PRAPolygon defined' 
    };
  }

  return { valid: true };
}

/**
 * Validates a spawn gear preset file
 * @param {Object} data - Parsed JSON data
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateSpawnGearFile(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object' };
  }

  // Loose validation: must have at least one of these arrays
  const hasAttachmentSlots = Array.isArray(data.attachmentSlotItemSets);
  const hasDiscreteUnsorted = Array.isArray(data.discreteUnsortedItemSets);

  if (!hasAttachmentSlots && !hasDiscreteUnsorted) {
    return { 
      valid: false, 
      error: "File must have 'attachmentSlotItemSets' and/or 'discreteUnsortedItemSets' array" 
    };
  }

  return { valid: true };
}

/**
 * Validates an object spawner file (generic DayZ spawner JSON)
 * @param {Object} data - Parsed JSON data
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateObjectSpawnerFile(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object' };
  }

  // Basic structure check - should be an object or array of objects
  if (Array.isArray(data)) {
    // Array of spawner objects is valid
    if (data.length === 0) {
      return { valid: false, error: 'Spawner file cannot be empty' };
    }
    
    // Check if array items are objects
    if (!data.every(item => item && typeof item === 'object')) {
      return { valid: false, error: 'All items in spawner array must be objects' };
    }
  } else {
    // Single object is valid
    if (Object.keys(data).length === 0) {
      return { valid: false, error: 'Spawner file cannot be empty' };
    }
  }

  return { valid: true };
}

/**
 * Determines file type and validates accordingly
 * @param {Object} file - Multer file object
 * @param {Object} data - Parsed JSON data
 * @param {string} fileType - Optional file type hint ('pra', 'spawngear', 'spawner')
 * @returns {Object} { valid: boolean, error?: string, type?: string }
 */
function validateDayZFile(file, data, fileType = null) {
  // Basic file validation
  const basicValidation = validateFileBasics(file);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  // JSON structure validation
  const structureValidation = validateJsonStructure(data);
  if (!structureValidation.valid) {
    return structureValidation;
  }

  // Type-specific validation
  if (fileType === 'pra') {
    const praValidation = validatePRAFile(data);
    return { ...praValidation, type: 'pra' };
  } else if (fileType === 'spawngear') {
    const gearValidation = validateSpawnGearFile(data);
    return { ...gearValidation, type: 'spawngear' };
  } else if (fileType === 'spawner') {
    const spawnerValidation = validateObjectSpawnerFile(data);
    return { ...spawnerValidation, type: 'spawner' };
  } else {
    // Auto-detect type based on structure
    if (data.areaName && data.PRABoxes && data.safePositions3D) {
      const praValidation = validatePRAFile(data);
      return { ...praValidation, type: 'pra' };
    } else if (data.attachmentSlotItemSets || data.discreteUnsortedItemSets) {
      const gearValidation = validateSpawnGearFile(data);
      return { ...gearValidation, type: 'spawngear' };
    } else {
      const spawnerValidation = validateObjectSpawnerFile(data);
      return { ...spawnerValidation, type: 'spawner' };
    }
  }
}

/**
 * Sanitizes filename for safe storage
 * @param {string} filename - Original filename
 * @param {string} prefix - Optional prefix to add
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename, prefix = '') {
  // Remove extension
  let name = filename.replace(/\.json$/i, '');
  
  // Remove dangerous characters
  name = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Limit length
  name = name.substring(0, 100);
  
  // Add prefix if provided
  if (prefix && !name.startsWith(prefix)) {
    name = prefix + name;
  }
  
  // Add extension back
  return name + '.json';
}

module.exports = {
  validateFileBasics,
  validateJsonStructure,
  validatePRAFile,
  validateSpawnGearFile,
  validateObjectSpawnerFile,
  validateDayZFile,
  sanitizeFilename,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES
};
