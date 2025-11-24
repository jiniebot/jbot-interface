const express = require("express");
const router = express.Router();

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.session.guildId && req.session.serviceId) {
    return next();
  }
  res.redirect("/selectGuildService");
}

// Render the Dashboard Page
router.get("/", isAuthenticated, (req, res) => {
  // Find the selected guild and service to get mapLoc
  let mapLoc = 0; // Default to Chernarus
  
  if (req.user && req.user.availableGuilds) {
    const selectedGuild = req.user.availableGuilds.find(g => g.guildId === req.session.guildId);
    if (selectedGuild && selectedGuild.services) {
      const selectedService = selectedGuild.services.find(s => s.serviceId === req.session.serviceId);
      if (selectedService && selectedService.mapLoc !== undefined) {
        mapLoc = selectedService.mapLoc;
      }
    }
  }
  
  res.render("dashboard-new", {
    user: req.user,
    guildId: req.session.guildId,
    serviceId: req.session.serviceId,
    mapLoc: mapLoc
  });
});

// Render the Store Management Page
router.get("/store", isAuthenticated, (req, res) => {
  res.render("store", {
    user: req.user,
    guildId: req.session.guildId,
    serviceId: req.session.serviceId
  });
});

module.exports = router;
