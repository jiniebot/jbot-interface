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


module.exports = router;
