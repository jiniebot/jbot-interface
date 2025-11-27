const express = require('express');
const router = express.Router();
const Globals = require('../schemas/globals/Globals');

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.session.guildId && req.session.serviceId) {
    return next();
  }
  res.redirect('/selectGuildService');
}

// Render settings page for the selected service
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const guildId = req.session.guildId;
    const serviceId = req.session.serviceId;

    const globals = await Globals.findOne({ guildid: guildId }).lean();

    if (!globals) {
      return res.render('settings', {
        user: req.user,
        guildId,
        serviceId,
        service: null,
        allServices: [],
      });
    }

    // Find the matching service by nitrado_service_id (serviceId is stored as nitrado id)
    const matched = (globals.services || []).find(s => {
      try {
        return s.ServerInfo && String(s.ServerInfo.nitrado_service_id) === String(serviceId);
      } catch (e) { return false; }
    }) || null;

    // Attempt to fetch guild roles and channels using bot token (if configured)
    let rolesList = [];
    let channelsList = [];
    try {
      if (process.env.DISCORD_BOT_TOKEN && guildId) {
        const rolesResp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });
        if (rolesResp.ok) rolesList = await rolesResp.json();

        const channelsResp = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        });
        if (channelsResp.ok) channelsList = await channelsResp.json();
      }
    } catch (e) {
      console.warn('Could not fetch guild roles/channels:', e && e.message ? e.message : e);
    }

    res.render('settings', {
      user: req.user,
      guildId,
      serviceId,
      service: matched,
      allServices: globals.services || [],
      rolesList,
      channelsList
    });
  } catch (err) {
    console.error('Error loading settings page:', err);
    res.status(500).send('Internal server error');
  }
});

// Update settings (Roles, RewardSettings, Options) for the selected service
router.post('/update', isAuthenticated, async (req, res) => {
  try {
    const guildId = req.session.guildId;
    const serviceId = req.session.serviceId;
    const { roles, rewardSettings, options } = req.body || {};

    if (!guildId || !serviceId) return res.status(400).json({ error: 'Missing session context' });

    const globals = await Globals.findOne({ guildid: guildId });
    if (!globals) return res.status(404).json({ error: 'Globals not found for guild' });

    const idx = (globals.services || []).findIndex(s => s.ServerInfo && String(s.ServerInfo.nitrado_service_id) === String(serviceId));
    if (idx === -1) return res.status(404).json({ error: 'Service not found' });

    const svc = globals.services[idx] || {};
    svc.Options = svc.Options || {};

    // Strict update: only allow updating existing keys - do not allow adding new keys
    // Roles
    if (roles && typeof roles === 'object') {
      if (!svc.Options.Roles) return res.status(400).json({ error: 'Roles not configured on service' });
      const invalid = Object.keys(roles).filter(k => !(k in svc.Options.Roles));
      if (invalid.length) return res.status(400).json({ error: `Invalid role keys: ${invalid.join(', ')}` });

      // roles values should be role names (strings)
      Object.keys(roles).forEach(k => {
        svc.Options.Roles[k] = String(roles[k]);
      });
    }

    // RewardSettings (numbers only)
    if (rewardSettings && typeof rewardSettings === 'object') {
      if (!svc.Options.RewardSettings) return res.status(400).json({ error: 'RewardSettings not configured on service' });
      const invalid = Object.keys(rewardSettings).filter(k => !(k in svc.Options.RewardSettings));
      if (invalid.length) return res.status(400).json({ error: `Invalid reward keys: ${invalid.join(', ')}` });

      Object.keys(rewardSettings).forEach(k => {
        const val = rewardSettings[k];
        const num = Number(val);
        if (Number.isNaN(num)) return res.status(400).json({ error: `RewardSetting ${k} must be a number` });
        svc.Options.RewardSettings[k] = num;
      });
    }

    // Options (typed - accept only existing keys)
    if (options && typeof options === 'object') {
      if (!svc.Options.Options) return res.status(400).json({ error: 'Options not configured on service' });
      const invalid = Object.keys(options).filter(k => !(k in svc.Options.Options));
      if (invalid.length) return res.status(400).json({ error: `Invalid option keys: ${invalid.join(', ')}` });

      Object.keys(options).forEach(k => {
        const current = svc.Options.Options[k];
        let newVal = options[k];
        // Coerce types based on current value
        if (typeof current === 'boolean') {
          newVal = (newVal === true || newVal === 'true' || newVal === '1');
        } else if (typeof current === 'number') {
          const num = Number(newVal);
          if (Number.isNaN(num)) return res.status(400).json({ error: `Option ${k} must be a number` });
          newVal = num;
        } else {
          newVal = String(newVal);
        }
        svc.Options.Options[k] = newVal;
      });
    }

    globals.services[idx] = svc;
    await globals.save();

    res.json({ ok: true, service: svc.Options });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Extended update: allow updating Discord channel/category links (strict keys)
router.post('/update-discord-links', isAuthenticated, async (req, res) => {
  try {
    const guildId = req.session.guildId;
    const serviceId = req.session.serviceId;
    const { channels, categories } = req.body || {};

    if (!guildId || !serviceId) return res.status(400).json({ error: 'Missing session context' });

    const globals = await Globals.findOne({ guildid: guildId });
    if (!globals) return res.status(404).json({ error: 'Globals not found for guild' });

    const idx = (globals.services || []).findIndex(s => s.ServerInfo && String(s.ServerInfo.nitrado_service_id) === String(serviceId));
    if (idx === -1) return res.status(404).json({ error: 'Service not found' });

    const svc = globals.services[idx] || {};

    // Channels
    if (channels && typeof channels === 'object') {
      svc.Discord_Channels = svc.Discord_Channels || {};
      // channels is expected as { sectionKey: { key: channelId } } or similar structure
      Object.keys(channels).forEach(sectionKey => {
        const section = channels[sectionKey];
        if (!svc.Discord_Channels[sectionKey]) return; // strict: ignore invalid sections
        Object.keys(section).forEach(k => {
          if (svc.Discord_Channels[sectionKey] && svc.Discord_Channels[sectionKey][k]) {
            svc.Discord_Channels[sectionKey][k].channelID = String(section[k]);
          }
        });
      });
    }

    // Categories
    if (categories && typeof categories === 'object') {
      svc.Discord_Categories = svc.Discord_Categories || {};
      Object.keys(categories).forEach(k => {
        if (svc.Discord_Categories[k]) {
          svc.Discord_Categories[k].channelID = String(categories[k]);
        }
      });
    }

    globals.services[idx] = svc;
    await globals.save();

    res.json({ ok: true, discord: true });
  } catch (err) {
    console.error('Error updating discord links:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
