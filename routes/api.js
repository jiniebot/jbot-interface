const express = require("express");
const router = express.Router();
const Globals = require("../schemas/globals/Globals");
const BaseProfile = require("../schemas/userData/BaseProfile");
const ActiveObjSp = require("../schemas/gameData/ActiveObjSp");
const MonitorZone = require("../schemas/gameData/MonitorZone");
const UserProfileSchema = require("../schemas/userData/UserProfile");
const { getModelForService } = require("../config/database");
const {
  requireAuthAndScope,
  sanitizeInput,
} = require("../config/validation");

// Lazy-load node-fetch (ESM) for faster Discord API calls without converting this file to ESM
let cachedFetch = null;
const fetch = (...args) => {
  if (cachedFetch) return cachedFetch(...args);
  return import("node-fetch").then(({ default: fn }) => {
    cachedFetch = fn;
    return fn(...args);
  });
};

// Apply sanitization to all API routes
router.use(sanitizeInput);

// Mount sub-routers for different API sections
router.use('/store', require('./api/store'));

// 🟢 Fetch Players (Scoped by Guild & Service)
router.get("/recent-players", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;

    // Find the correct guild and service
    const guild = await Globals.findOne(
      {
        guildid: guildId,
        "services.ServerInfo.nitrado_service_id": serviceId,
      },
      { "services.$": 1 } // Return only the matching service
    ).lean();

    if (!guild || !guild.services[0].ServerInfo.RecentPlayers) {
      return res.json({ recentPlayers: [] }); // Return empty if none found
    }

    const recentPlayers = guild.services[0].ServerInfo.RecentPlayers;

    // Get scoped UserProfile model
    const UserProfile = getModelForService("UserProfile", UserProfileSchema, guildId, serviceId);

    // Fetch UserProfile data for each recent player and merge
    const enrichedPlayers = await Promise.all(
      recentPlayers.map(async (player) => {
        try {
          // Find user profile by gamertag (guildID and serviceId automatically added by scoped model)
          const userProfile = await UserProfile.findOne({
            gamertag: player.gamertag,
          }).lean();

          // Merge RecentPlayers data with UserProfile data
          return {
            // Base data from RecentPlayers (priority for position/connection data)
            // Note: RecentPlayers uses "userId" (lowercase 'd'), UserProfile uses "userID" (uppercase 'D')
            userID: player.userId || player.userID, // Handle both cases
            gamertag: player.gamertag,
            lastPos: player.lastPos,
            lastSeen: player.lastSeen,
            serviceId: player.serviceId,
            
            // Enhanced data from UserProfile (if available)
            ...(userProfile && {
              userID: userProfile.userID, // UserProfile's userID (Discord ID) - will override RecentPlayers userId
              inGameID: userProfile.inGameID,
              userName: userProfile.userName,
              balance: userProfile.balance,
              factionID: userProfile.factionID,
              baseID: userProfile.baseID,
              lastConnected: userProfile.lastConnected,
              lastDisconnected: userProfile.lastDisconnected,
              timePlayed: userProfile.timePlayed,
              kills: userProfile.kills,
              deaths: userProfile.deaths,
              friendlyKills: userProfile.friendlyKills,
              last5Kills: userProfile.last5Kills,
              last10Pos: userProfile.last10Pos,
              stolenFactionMoney: userProfile.stolenFactionMoney,
              lifetimeBuiltItems: userProfile.lifetimeBuiltItems,
              lifetimeTeleports: userProfile.lifetimeTeleports,
              lifetimePlacedItems: userProfile.lifetimePlacedItems,
              lifetimeEmotes: userProfile.lifetimeEmotes,
              completedBounties: userProfile.completedBounties,
              bounties: userProfile.bounties,
              completedDailyQuests: userProfile.completedDailyQuests,
              completedWeeklyQuests: userProfile.completedWeeklyQuests,
              altgamertag: userProfile.altgamertag,
            }),
            
            // Flag to indicate if profile was found
            hasProfile: !!userProfile,
          };
        } catch (error) {
          console.error(`Error fetching profile for ${player.gamertag}:`, error);
          // Return player data without profile if fetch fails
          return {
            ...player,
            hasProfile: false,
          };
        }
      })
    );

    res.json({ recentPlayers: enrichedPlayers });
  } catch (err) {
    console.error("❌ Error fetching RecentPlayers:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟢 Fetch Bases (Scoped by Guild & Service)
router.get("/bases", requireAuthAndScope, async (req, res) => {
  try {
    const bases = await BaseProfile.find({
      guildID: req.session.guildId,
      serviceId: req.session.serviceId,
    });

    res.json({ bases });
  } catch (err) {
    console.error("❌ Error fetching bases:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🟢 Fetch Active Object Spawners (Scoped by Guild & Service)
router.get("/spawners", requireAuthAndScope, async (req, res) => {
  try {
    const spawners = await ActiveObjSp.find({
      isActive: true,
      guildID: req.session.guildId,
      serviceId: req.session.serviceId,
    });

    //console.log("Fetched spawners:", spawners); // Debugging line

    res.json({ spawners });
  } catch (err) {
    console.error("❌ Error fetching spawners:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🟢 Fetch Monitor Zones (Scoped by Guild & Service)
router.get("/monitorZones", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;

    const monitorZones = await MonitorZone.find({
      guildID: guildId,
      serviceId: serviceId,
    });

    res.json({ monitorZones });
  } catch (error) {
    console.error("❌ Error fetching MonitorZones:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🟢 Create Monitor Zone (circle or polygon)
router.post("/monitorZones", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    // Prefer authenticated Discord user id; fall back to session passport payload or guild
    const owner =
      req.user?.id ||
      req.session?.passport?.user?.id ||
      req.session?.userId ||
      req.session?.user?.id ||
      guildId;

    const {
      name,
      zoneType = 0,
      location = [],
      range,
      polygon = [],
      radarChannel = "N/A",
      type = "Monitor",
      isActive = true,
      baseID,
      lifetime,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const numericZoneType = Number(zoneType);
    if (![0, 1].includes(numericZoneType)) {
      return res.status(400).json({ error: "zoneType must be 0 (circle) or 1 (polygon)" });
    }

    // Normalize incoming location for circles (can be array, object, or JSON string)
    const normalizeCircleLocation = (loc) => {
      if (Array.isArray(loc)) {
        if (loc.length === 2) return [Number(loc[0]), 0, Number(loc[1])];
        return loc.map((v) => Number(v));
      }
      if (loc && typeof loc === "object") {
        const xVal = Number(loc.x ?? loc[0]);
        const yVal = Number.isFinite(Number(loc.y ?? loc[1])) ? Number(loc.y ?? loc[1]) : 0;
        const zVal = Number(loc.z ?? loc[2]);
        return [xVal, yVal, zVal];
      }
      if (typeof loc === "string") {
        try {
          const parsed = JSON.parse(loc);
          return normalizeCircleLocation(parsed);
        } catch (e) {
          return [];
        }
      }
      return [];
    };

    let normalizedLocation = [];
    if (numericZoneType === 0) {
      normalizedLocation = normalizeCircleLocation(location);
      const [x, y = 0, z] = normalizedLocation;
      if (![x, z].every((v) => Number.isFinite(v))) {
        return res.status(400).json({ error: "location must include x and z for circular zones", received: location });
      }
      if (!Number.isFinite(Number(range)) || Number(range) <= 0) {
        return res.status(400).json({ error: "range must be a positive number for circular zones" });
      }
    } else {
      const normalizePolygon = (polyInput) => {
        let parsed = polyInput;
        if (typeof polyInput === "string") {
          try {
            parsed = JSON.parse(polyInput);
          } catch (e) {
            parsed = [];
          }
        }
        if (!Array.isArray(parsed)) {
          // handle arrays that were sanitized into objects with numeric keys
          if (parsed && typeof parsed === "object") {
            const numericKeys = Object.keys(parsed)
              .filter((k) => /^\d+$/.test(k))
              .sort((a, b) => Number(a) - Number(b));
            parsed = numericKeys.map((k) => parsed[k]);
          } else {
            return [];
          }
        }
        return parsed
          .map((pt) => {
            if (!pt) return null;
            // accept {x,y} or {x,z} or [x,y]
            const xVal = Number(pt.x ?? pt[0]);
            const yVal = Number(pt.y ?? pt.z ?? pt[1]);
            return { x: xVal, y: yVal };
          })
          .filter((pt) => Number.isFinite(pt?.x) && Number.isFinite(pt?.y));
      };

      const normalizedPolygon = normalizePolygon(polygon);

      if (!Array.isArray(normalizedPolygon) || normalizedPolygon.length < 3) {
        return res.status(400).json({ error: "polygon with at least 3 points is required for polygon zones", received: polygon });
      }
      const invalidPoint = normalizedPolygon.some((pt) => !pt || !Number.isFinite(Number(pt.x)) || !Number.isFinite(Number(pt.y)));
      if (invalidPoint) {
        return res.status(400).json({ error: "polygon points must include numeric x and y" });
      }

      // replace polygon with normalized version for persistence
      req.body.polygon = normalizedPolygon;
    }

    const zone = new MonitorZone({
      owner: owner || guildId,
      guildID: guildId,
      serviceId,
      name,
      zoneType: numericZoneType,
      radarChannel,
      type,
      isActive: Boolean(isActive),
      baseID,
      lifetime,
    });

    if (numericZoneType === 0) {
      const [x, y = 0, z] = normalizedLocation;
      zone.location = [x, y, z];
      zone.range = Number(range);
      zone.polygon = [];
    } else {
      const normalizedPolygon = Array.isArray(req.body.polygon)
        ? req.body.polygon
        : [];
      zone.polygon = normalizedPolygon.map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }));
      zone.location = [];
      zone.range = undefined;
    }

    await zone.save();

    res.status(201).json({ zone });
  } catch (error) {
    console.error("❌ Error creating MonitorZone:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: error.message });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🟡 Toggle Monitor Zone active flag
router.post("/monitorZones/:id/toggle", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const zone = await MonitorZone.findOne({
      _id: req.params.id,
      guildID: guildId,
      serviceId,
    });

    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }

    zone.isActive = !zone.isActive;
    await zone.save();

    res.json({ zone });
  } catch (error) {
    console.error("❌ Error toggling MonitorZone:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🔴 Delete Monitor Zone
router.delete("/monitorZones/:id", requireAuthAndScope, async (req, res) => {
  try {
    const { guildId, serviceId } = req.session;
    const zone = await MonitorZone.findOneAndDelete({
      _id: req.params.id,
      guildID: guildId,
      serviceId,
    });

    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }

    res.json({ message: "Zone deleted", zone });
  } catch (error) {
    console.error("❌ Error deleting MonitorZone:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Discord helpers (bot token required)
const getBotToken = () => process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_APP_TOKEN;

router.get("/discord/channels", requireAuthAndScope, async (req, res) => {
  try {
    const token = getBotToken();
    if (!token) return res.status(400).json({ error: "Discord bot token not configured" });

    const { guildId } = req.session;
    if (!guildId) return res.status(400).json({ error: "Missing guild context" });

    const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: "Failed to fetch channels", details: text });
    }

    const channels = await resp.json();
    // Filter to text/announcement/voice threads; keep id/name/type/parent_id
    const normalized = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parent_id: ch.parent_id || null,
    }));

    res.json({ channels: normalized });
  } catch (err) {
    console.error("❌ Error fetching Discord channels:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/discord/roles", requireAuthAndScope, async (req, res) => {
  try {
    const token = getBotToken();
    if (!token) return res.status(400).json({ error: "Discord bot token not configured" });

    const { guildId } = req.session;
    if (!guildId) return res.status(400).json({ error: "Missing guild context" });

    const resp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: "Failed to fetch roles", details: text });
    }

    const roles = await resp.json();
    const normalized = roles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      position: r.position,
    }));

    res.json({ roles: normalized });
  } catch (err) {
    console.error("❌ Error fetching Discord roles:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/discord/users", requireAuthAndScope, async (req, res) => {
  try {
    const token = getBotToken();
    if (!token) return res.status(400).json({ error: "Discord bot token not configured" });

    const ids = []
      .concat(req.query.id || [])
      .concat(req.query.ids || [])
      .flatMap((v) => (Array.isArray(v) ? v : String(v || "").split(",")))
      .map((v) => v.trim())
      .filter(Boolean);

    if (!ids.length) return res.status(400).json({ error: "At least one user id is required" });

    const uniqueIds = [...new Set(ids)];
    const results = {};

    // Discord has no bulk user lookup for bots; fetch sequentially (ids are small set from UI)
    for (const id of uniqueIds) {
      try {
        const resp = await fetch(`https://discord.com/api/v10/users/${id}`, {
          headers: { Authorization: `Bot ${token}` },
        });
        if (!resp.ok) {
          results[id] = { error: `HTTP ${resp.status}` };
          continue;
        }
        const user = await resp.json();
        results[id] = { id: user.id, username: user.username, global_name: user.global_name, display_name: user.display_name };
      } catch (e) {
        results[id] = { error: e.message || "fetch_failed" };
      }
    }

    res.json({ users: results });
  } catch (err) {
    console.error("❌ Error fetching Discord users:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;
