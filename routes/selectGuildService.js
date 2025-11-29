const express = require("express");
const router = express.Router();

// Guild Selection Page
router.get("/", async (req, res) => {
  if (!req.isAuthenticated() || !req.user.availableGuilds) {
    return res.redirect("/");
  }

  if (req.user.availableGuilds.length === 1) {
    const selectedGuild = req.user.availableGuilds[0];
    const activeServices = (selectedGuild.services || []).filter((service) => {
      const status = String(
        service.subscriptionStatus ||
        service.ServerInfo?.subscriptionStatus ||
        ''
      ).toLowerCase();
      return status !== 'inactive';
    });

    req.session.guildId = selectedGuild.guildId;

    if (activeServices.length === 1) {
      req.session.serviceId = activeServices[0].serviceId;
      return req.session.save(() => res.redirect("/dashboard"));
    }

    const showBackButton = req.user.availableGuilds.length > 1;
    return req.session.save(() => res.render("selectService", { guild: { ...selectedGuild, services: activeServices }, showBackButton }));
  }

  // Fetch all user guilds from Discord API using their OAuth token
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${req.user.accessToken}`
      }
    });

    if (response.ok) {
      const userGuilds = await response.json();
      
      // Create a map of guild info for quick lookup
      const guildInfoMap = new Map(
        userGuilds.map(g => [g.id, g])
      );
      
      // Enhance available guilds with Discord info
      const guildsWithInfo = req.user.availableGuilds.map(guild => {
        const discordGuild = guildInfoMap.get(guild.guildId);
        
        if (discordGuild) {
          return {
            ...guild,
            guildName: discordGuild.name || guild.guildName,
            iconHash: discordGuild.icon,
            iconUrl: discordGuild.icon 
              ? `https://cdn.discordapp.com/icons/${guild.guildId}/${discordGuild.icon}.png?size=512`
              : null
          };
        }
        
        // Return original guild data if not found
        return {
          ...guild,
          iconHash: null,
          iconUrl: null
        };
      });
      
      return res.render("selectGuild", { guilds: guildsWithInfo });
    }
  } catch (error) {
    console.error('Error fetching guilds from Discord:', error);
  }
  
  // Fallback: render without enhanced info
  const guildsWithFallback = req.user.availableGuilds.map(guild => ({
    ...guild,
    iconHash: null,
    iconUrl: null
  }));
  
  res.render("selectGuild", { guilds: guildsWithFallback });
});

// Handle Guild Selection (Return services as JSON)
router.post("/guild", (req, res) => {
  const selectedGuild = req.user.availableGuilds.find(g => g.guildId === req.body.guildId);

  if (!selectedGuild) return res.status(404).json({ error: "Guild not found" });

  req.session.guildId = selectedGuild.guildId;

  const activeServices = (selectedGuild.services || []).filter((service) => {
    const status = String(
      service.subscriptionStatus ||
      service.ServerInfo?.subscriptionStatus ||
      ''
    ).toLowerCase();
    return status !== 'inactive';
  });

  if (activeServices.length === 1) {
    req.session.serviceId = activeServices[0].serviceId;
    return req.session.save(() => res.json({ redirect: "/dashboard" }));
  }

  req.session.save(() => res.json({ 
    services: activeServices,
    guildName: selectedGuild.guildName 
  }));
});

// Handle Service Selection
router.post("/service", (req, res) => {
  const selectedGuild = req.user.availableGuilds.find(g => g.guildId === req.session.guildId);

  if (!selectedGuild) return res.status(404).json({ error: "Guild not found" });

  const selectedService = selectedGuild.services.find(s => s.serviceId === req.body.serviceId);

  if (!selectedService) return res.status(404).json({ error: "Service not found" });

  // Check if the service is inactive
  const status = String(
    selectedService.subscriptionStatus ||
    selectedService.ServerInfo?.subscriptionStatus ||
    ''
  ).toLowerCase();
  
  if (status === 'inactive') {
    return res.status(403).json({ error: "Service is inactive" });
  }

  req.session.serviceId = selectedService.serviceId;
  // If this request came from JS (fetch), return JSON with redirect URL so the client can navigate
  return req.session.save(() => {
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
      return res.json({ redirect: "/dashboard" });
    }
    // Fallback for non-AJAX requests
    return res.redirect("/dashboard");
  });
});

module.exports = router;
