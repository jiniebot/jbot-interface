const express = require("express");
const router = express.Router();

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.session.guildId && req.session.serviceId) {
    return next();
  }
  return res.redirect("/selectGuildService");
}

router.get("/", isAuthenticated, (req, res) => {
  res.render("spawner-queue", {
    user: req.user,
    guildId: req.session.guildId,
    serviceId: req.session.serviceId,
  });
});

module.exports = router;
