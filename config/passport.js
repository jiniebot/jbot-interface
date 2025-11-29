require("dotenv").config();

const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const Globals = require("../schemas/globals/Globals");

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_CALLBACK_URL,
      scope: ["identify", "guilds"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find all Globals where user is an owner or authorized user
        const userGuilds = await Globals.find({
          services: {
            $elemMatch: {
              $or: [
                { "ServerInfo.ownerid": profile.id },
                { "ServerInfo.authorizedUsers": profile.id }
              ]
            }
          }
        }).lean();

        if (!userGuilds || userGuilds.length === 0) {
          return done(null, false, { message: "No authorized guilds found." });
        }

        // Structure guilds with services
        const availableGuilds = userGuilds.map(guild => ({
          guildId: guild.guildid,
          guildName: `Guild ${guild.guildid}`,
          services: guild.services
            .filter(service => {
              // Filter out inactive services at authentication time
              const status = String(
                service.subscriptionStatus ||
                service.ServerInfo?.subscriptionStatus ||
                ''
              ).toLowerCase();
              return status !== 'inactive';
            })
            .map(service => ({
              serviceId: service.ServerInfo?.nitrado_service_id || "Unknown",
              serviceName: service.ServerInfo?.server_name || "Unnamed Service",
              mapLoc: Number(service.ServerInfo?.mapLoc ?? 0),
              subscriptionStatus: service.subscriptionStatus || service.ServerInfo?.subscriptionStatus || '',
              ServerInfo: {
                subscriptionStatus: service.ServerInfo?.subscriptionStatus || ''
              }
            }))
        }));

        return done(null, {
          id: profile.id,
          username: profile.username,
          avatar: profile.avatar,
          accessToken: accessToken,
          refreshToken: refreshToken,
          availableGuilds
        });

      } catch (err) {
        console.error("❌ Error fetching user data:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));

passport.deserializeUser(async (user, done) => {
  try {
    done(null, user);
  } catch (err) {
    console.error("❌ Deserialization Error:", err);
    done(err, null);
  }
});

module.exports = passport;
