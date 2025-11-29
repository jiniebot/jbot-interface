const express = require("express");
const router = express.Router();

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.session.guildId && req.session.serviceId) {
    return next();
  }
  return res.redirect("/selectGuildService");
}

router.get("/", isAuthenticated, (req, res) => {
  // Get Queue API URL from environment or default to localhost
  const queueApiUrl = process.env.QUEUE_API_URL || 'http://localhost:4310';
  
  res.render("spawner-queue", {
    user: req.user,
    guildId: req.session.guildId,
    serviceId: req.session.serviceId,
    queueApiUrl: queueApiUrl,
  });
});

module.exports = router;
