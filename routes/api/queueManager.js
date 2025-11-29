const express = require("express");
const router = express.Router();
const Globals = require("../../schemas/globals/Globals");
const { requireAuthAndScope } = require("../../config/validation");
const cache = require("../../utils/cache");

let cachedFetch = null;
const fetch = (...args) => {
  if (cachedFetch) return cachedFetch(...args);
  return import("node-fetch").then(({ default: fn }) => {
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

function normalizeFileName(name = "") {
  return name.replace(/\.json$/i, "").trim();
}

async function queueApiFetch(path, options = {}) {
  const url = `${QUEUE_API_BASE.replace(/\/$/, "")}${path}`;
  const headers = Object.assign({}, options.headers || {}, {
    "Content-Type": "application/json",
  });

  if (QUEUE_API_KEY) {
    headers["X-API-Key"] = QUEUE_API_KEY;
  }

  const response = await fetch(url, {
    ...options,
    headers,
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

async function getServiceFromGlobals(guildId, serviceId) {
  const guild = await Globals.findOne(
    {
      guildid: guildId,
      "services.ServerInfo.nitrado_service_id": serviceId,
    },
    { "services.$": 1 }
  ).lean();

  return guild?.services?.[0];
}

router.get("/queue", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;

    // Check cache first
    const cacheKey = cache.generateKey('queue:data', guildId, serviceId);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const data = await queueApiFetch(`/services/${serviceId}/queue`, {
      method: "GET",
    });

    cache.set(cacheKey, data, 15000); // Cache for 15 seconds
    res.json(data);
  } catch (error) {
    console.error("Queue API queue fetch failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load queue" });
  }
});

router.get("/queue/status", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;

    // Check cache first
    const cacheKey = cache.generateKey('queue:status', guildId, serviceId);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const data = await queueApiFetch(`/services/${serviceId}/queue/status`, {
      method: "GET",
    });

    cache.set(cacheKey, data, 10000); // Cache for 10 seconds
    res.json(data);
  } catch (error) {
    console.error("Queue API status fetch failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load queue status" });
  }
});

router.post("/queue/webhook", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const { url } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "url is required" });
    }

    const data = await queueApiFetch(`/services/${serviceId}/queue/webhook`, {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    res.json(data);
  } catch (error) {
    console.error("Queue API webhook registration failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to register webhook" });
  }
});

router.delete("/queue/webhook", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const { url } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "url is required" });
    }

    const data = await queueApiFetch(`/services/${serviceId}/queue/webhook`, {
      method: "DELETE",
      body: JSON.stringify({ url }),
    });
    res.json(data);
  } catch (error) {
    console.error("Queue API webhook unregistration failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to unregister webhook" });
  }
});

router.post("/queue", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const { fileName, action, settings } = req.body || {};
    if (!fileName || !action) {
      return res.status(400).json({ error: "fileName and action are required" });
    }

    const payload = {
      fileName: normalizeFileName(fileName),
      action,
    };

    if (action === "update-settings" && Array.isArray(settings)) {
      payload.settings = settings;
    }

    const data = await queueApiFetch(`/services/${serviceId}/queue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    // Invalidate cache
    const { guildId } = req.session;
    cache.invalidate(cache.generateKey('queue:data', guildId, serviceId));
    cache.invalidate(cache.generateKey('queue:status', guildId, serviceId));
    
    res.status(201).json(data);
  } catch (error) {
    console.error("Queue API add failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to add to queue" });
  }
});

router.patch("/queue/:idOrIndex", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const { idOrIndex } = req.params;
    
    // Accept both ID (string) and index (number)
    const identifier = Number.isNaN(Number.parseInt(idOrIndex, 10)) 
      ? idOrIndex // It's an ID string
      : Number.parseInt(idOrIndex, 10); // It's an index

    const payload = Object.assign({}, req.body || {});
    if (payload.fileName) {
      payload.fileName = normalizeFileName(payload.fileName);
    }

    const data = await queueApiFetch(`/services/${serviceId}/queue/${identifier}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    
    // Invalidate cache
    const { guildId } = req.session;
    cache.invalidate(cache.generateKey('queue:data', guildId, serviceId));
    cache.invalidate(cache.generateKey('queue:status', guildId, serviceId));
    
    res.json(data);
  } catch (error) {
    console.error("Queue API update failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to update queue item" });
  }
});

router.delete("/queue/:idOrIndex", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const { idOrIndex } = req.params;
    
    // Accept both ID (string) and index (number)
    const identifier = Number.isNaN(Number.parseInt(idOrIndex, 10)) 
      ? idOrIndex // It's an ID string
      : Number.parseInt(idOrIndex, 10); // It's an index

    const data = await queueApiFetch(`/services/${serviceId}/queue/${identifier}`, {
      method: "DELETE",
    });
    
    // Invalidate cache
    const { guildId } = req.session;
    cache.invalidate(cache.generateKey('queue:data', guildId, serviceId));
    cache.invalidate(cache.generateKey('queue:status', guildId, serviceId));
    
    res.json(data);
  } catch (error) {
    console.error("Queue API delete failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to remove queue item" });
  }
});

router.post("/queue/process", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const data = await queueApiFetch(`/services/${serviceId}/queue/process`, {
      method: "POST",
    });
    
    // Invalidate cache
    const { guildId } = req.session;
    cache.invalidate(cache.generateKey('queue:status', guildId, serviceId));
    
    res.status(202).json(data);
  } catch (error) {
    console.error("Queue API process trigger failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to trigger queue processing" });
  }
});

router.post("/queue/clear", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const data = await queueApiFetch(`/services/${serviceId}/queue/clear`, {
      method: "POST",
    });
    
    // Invalidate cache
    const { guildId } = req.session;
    cache.invalidate(cache.generateKey('queue:data', guildId, serviceId));
    cache.invalidate(cache.generateKey('queue:status', guildId, serviceId));
    
    res.json(data);
  } catch (error) {
    console.error("Queue API clear failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to clear queue" });
  }
});

router.get("/files", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const keyword = req.query.keyword ? `?keyword=${encodeURIComponent(req.query.keyword)}` : "";
    const data = await queueApiFetch(`/services/${serviceId}/files${keyword}`, {
      method: "GET",
    });
    res.json(data);
  } catch (error) {
    console.error("Queue API files fetch failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load files" });
  }
});

router.post("/upload", requireAuthAndScope, async (req, res) => {
  try {
    const { serviceId } = req.session;
    const { fileName, contents, queueAction = "add" } = req.body || {};

    if (!fileName || !contents) {
      return res.status(400).json({ error: "fileName and contents are required" });
    }

    let parsed;
    try {
      parsed = JSON.parse(contents);
    } catch (err) {
      return res.status(400).json({ error: "contents must be valid JSON" });
    }

    const normalizedName = normalizeFileName(fileName);
    await queueApiFetch(`/services/${serviceId}/upload`, {
      method: "POST",
      body: JSON.stringify({
        fileName: normalizedName,
        contents: JSON.stringify(parsed, null, 2),
      }),
    });

    let queueResponse = null;
    if (queueAction) {
      queueResponse = await queueApiFetch(`/services/${serviceId}/queue`, {
        method: "POST",
        body: JSON.stringify({
          fileName: normalizedName,
          action: queueAction,
        }),
      });
    }

    res.json({
      uploaded: true,
      queued: !!queueAction,
      queue: queueResponse?.queue,
    });
  } catch (error) {
    console.error("Queue upload failed:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to upload file" });
  }
});

router.get("/stats", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const service = await getServiceFromGlobals(guildId, serviceId);

    if (!service?.ServerInfo) {
      return res.status(404).json({ error: "Service info not found" });
    }

    const stats = service.ServerInfo.RestartStats || {};
    const now = Date.now();

    const response = {
      serverName: service.ServerInfo.server_name,
      restartStats: stats,
      lastRestartISO: service.ServerInfo.LastRestartISO || service.ServerInfo.LastRestart || null,
      nextRestartInMs: stats?.predictedNextAtISO
        ? new Date(stats.predictedNextAtISO).getTime() - now
        : null,
      nextPreQueueInMs: stats?.preQueue?.forRestartAtISO
        ? new Date(stats.preQueue.forRestartAtISO).getTime() - now
        : null,
      queueLastProcessedInMs: stats?.queue?.lastProcessedAtISO
        ? now - new Date(stats.queue.lastProcessedAtISO).getTime()
        : null,
    };

    res.json(response);
  } catch (error) {
    console.error("Failed to load restart stats:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load restart stats" });
  }
});

module.exports = router;
