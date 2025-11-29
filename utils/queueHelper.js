/**
 * Queue Helper - Shared utility for adding items to the queue
 */

// Lazy-load node-fetch (ES module)
let cachedFetch = null;
const fetch = (...args) => {
  if (cachedFetch) return cachedFetch(...args);
  return import('node-fetch').then(({ default: fn }) => {
    cachedFetch = fn;
    return fn(...args);
  });
};

const QUEUE_API_BASE =
  process.env.QUEUE_API_BASE ||
  process.env.DASHBOARD_API_BASE ||
  `http://localhost:${process.env.DASHBOARD_API_PORT || 4310}`;

const QUEUE_API_KEY =
  process.env.QUEUE_API_KEY ||
  process.env.DASHBOARD_API_KEY ||
  process.env.API_KEY ||
  "";

/**
 * Add item to queue via Queue API
 * @param {string} serviceId - Service ID
 * @param {string} fileName - File name (without .json extension)
 * @param {string} action - Action type (add, remove, add-pra, etc.)
 * @param {object} options - Additional options (settings for update-settings action)
 * @returns {Promise<object>} Queue data
 */
async function addToQueue(serviceId, fileName, action, options = {}) {
  const url = `${QUEUE_API_BASE.replace(/\/$/, "")}/services/${serviceId}/queue`;
  
  const headers = {
    "Content-Type": "application/json",
  };

  if (QUEUE_API_KEY) {
    headers["X-API-Key"] = QUEUE_API_KEY;
  }

  const payload = {
    fileName: fileName.replace(/\.json$/i, '').trim(),
    action,
  };

  if (action === "update-settings" && Array.isArray(options.settings)) {
    payload.settings = options.settings;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (err) {
    json = { error: "Invalid JSON response from queue API" };
  }

  if (!response.ok) {
    const message = json?.error || `Queue API request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = json;
    throw error;
  }

  return json;
}

module.exports = {
  addToQueue
};
