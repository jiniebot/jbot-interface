const express = require("express");
const passport = require("passport");
const router = express.Router();

// Discord login route
router.get("/login", passport.authenticate("discord"));

// Discord callback route
router.get("/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    console.log("🔍 OAuth Callback - User:", req.user?.id);
    console.log("🔍 Available Guilds:", req.user?.availableGuilds?.length);
    
    if (!req.user || !req.user.availableGuilds) {
      console.log("❌ No user or guilds found");
      return res.redirect("/");
    }

    console.log("✅ User has guilds:", req.user.availableGuilds.length);

    // Regenerate session after successful authentication to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error("❌ Session regeneration error:", err);
        return res.redirect("/");
      }

      console.log("✅ Session regenerated");

      // Store user in new session
      req.session.passport = { user: req.user };

      // If only 1 guild, store it in session
      if (req.user.availableGuilds.length === 1) {
        req.session.guildId = req.user.availableGuilds[0].guildId;
        console.log("✅ Auto-selected guild:", req.session.guildId);

        // If only 1 service, auto-select it
        if (req.user.availableGuilds[0].services.length === 1) {
          req.session.serviceId = req.user.availableGuilds[0].services[0].serviceId;
          console.log("✅ Auto-selected service:", req.session.serviceId);
          return req.session.save((saveErr) => {
            if (saveErr) console.error("❌ Session save error:", saveErr);
            console.log("🔀 Redirecting to dashboard");
            res.redirect("/dashboard");
          });
        }
        
        return req.session.save((saveErr) => {
          if (saveErr) console.error("❌ Session save error:", saveErr);
          console.log("🔀 Redirecting to selectGuildService");
          res.redirect("/selectGuildService");
        });
      }

      // Redirect to Guild Selection if multiple
      req.session.save((saveErr) => {
        if (saveErr) console.error("❌ Session save error:", saveErr);
        console.log("🔀 Redirecting to selectGuildService (multiple guilds)");
        res.redirect("/selectGuildService");
      });
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
