const express = require("express");
const passport = require("passport");
const router = express.Router();

// Discord login route
router.get("/login", passport.authenticate("discord"));

// Discord callback route
router.get("/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    //console.log("✅ User Authenticated:", req.user);
    
    if (!req.user || !req.user.availableGuilds) {
      return res.redirect("/");
    }

    // Regenerate session after successful authentication to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error("❌ Session regeneration error:", err);
        return res.redirect("/");
      }

      // Store user in new session
      req.session.passport = { user: req.user };

      // If only 1 guild, store it in session
      if (req.user.availableGuilds.length === 1) {
        req.session.guildId = req.user.availableGuilds[0].guildId;

        // If only 1 service, auto-select it
        if (req.user.availableGuilds[0].services.length === 1) {
          req.session.serviceId = req.user.availableGuilds[0].services[0].serviceId;
          return req.session.save(() => res.redirect("/dashboard"));
        }
        
        return req.session.save(() => res.redirect("/selectGuildService"));
      }

      // Redirect to Guild Selection if multiple
      req.session.save(() => res.redirect("/selectGuildService"));
    });
  }
);

// Logout
router.get("/logout", (req, res) => {
  req.logout(() => {
    // Destroy session completely on logout
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Session destruction error:", err);
      }
      res.clearCookie("sessionId"); // Clear session cookie
      res.redirect("/");
    });
  });
});

module.exports = router;
