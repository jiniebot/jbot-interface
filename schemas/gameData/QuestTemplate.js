const { Schema } = require("mongoose");

const QuestTemplateSchema = new Schema(
  {
    //Required Fields
    guildID: { type: String, required: true },
    serviceId: { type: String, required: true },
    userID: { type: String, required: true },
    questID: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true }, // e.g., "kill", "location", "interaction"
    description: { type: String, required: true },
    rewardNomad: { type: Number, required: true },
    rewardMoney: { type: Number, required: true },
    rewardShop: { type: String, required: true },
    lifetime: { type: Number, required: true },
    accepted: { type: Number, required: true },
    role: { type: String, required: true },
    active: { type: Boolean, default: false },
    complete: { type: Boolean, default: false },

    // Fields for "kill-gun", "kill-melee" and "streak" quests i.e get 10 kills with any weapon, with m4a1, with baseball bat, with no deaths, from 10 meters, etc. .
    // Kills and deaths start at max # and get decremented until 0 = sucess or 0 = failure for deaths.
    // kills = 10 means 10 remaining kills to go.
    requiredKills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    weapon: { type: String, default: "any" }, //weapon type or knife of tool type for melee
    distance: { type: Number, default: 0 }, //Always 0 for melee kills
    who: { type: String, default: "any" }, //Gamertag for specific player in case of targeted quest.

    // Fields for "location", "placement", "placement-location" quests

    locations: [
      {
        name: { type: String, required: true }, // Add name field for the location
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        visited: { type: Boolean, default: false },
        _id: false,
      },
    ],
    completedLocations: [
      {
        name: { type: String },
        x: { type: Number },
        y: { type: Number },
        _id: false,
      },
    ],
    items: { type: [String], default: [] },

    //Combine above for "kill-location" or "kill-player-at-location"
    //Combine above for "life-streak" i.e no deaths for X time.
  },
  { timestamps: true }
);

module.exports = QuestTemplateSchema;
