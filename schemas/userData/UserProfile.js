const { Schema } = require("mongoose");

const gamertagPairSchema = new Schema(
  {
    gamertag: {
      type: String,
      required: true,
    },
    inGameID: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const UserProfileSchema = new Schema(
  {
    userID: {
      type: String,
      required: true,
      default: "unlinked",
      sparse: true,
    },
    inGameID: {
      type: String,
      required: true,
      default: "unlinked",
      sparse: true,
    },
    userName: {
      type: String,
      required: false,
    },
    gamertag: {
      type: String,
      required: true,
      sparse: true,
    },
    altgamertag: [gamertagPairSchema],
    guildID: {
      type: String,
      required: true,
    },
    serviceId: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      set: (v) => Math.round(v * 100) / 100,
    },
    lastDailyCollected: {
      type: Date,
    },
    factionID: {
      type: String,
      required: false,
    },
    baseID: {
      type: String,
      required: false,
    },
    lastPos: {
      type: [Number],
      required: false,
    },

    last10Pos: [
      {
        x: Number,
        y: Number,
        z: Number,
      },
    ],

    lastSpotted: {
      type: Date,
      required: false,
    },
    lastConnected: {
      type: Date,
      required: false,
    },
    lastDisconnected: {
      type: Date,
      required: false,
    },
    timePlayed: {
      type: Number,
      required: false,
    },
    lastPlacedItem: {
      type: [Number],
      required: false,
    },
    lastRaisedFlag: {
      type: [Number],
      required: false,
    },
    logLastPlacement: {
      type: Boolean,
      required: false,
    },
    logLastPlacementTime: {
      type: Date,
      required: false,
    },
    placedItemCount: {
      type: Number,
      required: false,
    },
    isAllowedBaseCreation: {
      type: Boolean,
      required: false,
    },
    isAddingBase: { type: Boolean, required: false },
    baseAddTime: {
      type: Date,
      required: false,
    },
    isAllowedFaction: {
      type: Boolean,
      required: false,
    },
    kills: {
      type: Number,
      default: 0,
    },
    deaths: {
      type: Number,
      default: 0,
    },
    friendlyKills: {
      type: Number,
      default: 0,
    },
    last5Kills: [
      {
        victim: String,
        timeLog: Date,
        timeLocal: Date,
        distance: Number,
        location: String,
      },
    ],

    stolenFactionMoney: {
      type: Map,
      of: Number,
      default: {},
    },

    lifetimeBuiltItems: {
      type: Number,
      default: 0,
    },
    lifetimeTeleports: {
      type: Number,
      default: 0,
    },
    lifetimePlacedItems: {
      type: Number,
      default: 0,
    },
    lifetimeEmotes: {
      type: Number,
      default: 0,
    },
    completedBounties: [
      {
        bountyID: {
          type: String, // Unique identifier for the bounty
          required: true,
        },
        target: {
          type: String, // UserID or gamertag of the bounty target
          required: true,
        },
        reward: {
          type: Number, // Reward amount for the bounty
          required: true,
          set: (v) => Math.round(v * 100) / 100, // Ensures reward is rounded to 2 decimal places
        },
        claimedAt: {
          type: Date, // Timestamp when the bounty was claimed
          required: true,
        },
        location: {
          type: [Number], // [x, y, z] coordinates of the claim
          required: false,
        },
        distance: {
          type: Number, // Distance between the player and the target when the bounty was claimed
          required: false,
        },
        weaponUsed: {
          type: String, // Weapon used to claim the bounty
          required: false,
        },
        notes: {
          type: String, // Additional notes about the completed bounty
          required: false,
        },
      },
    ],
    bounties: [
      {
        createdAt: {
          type: Date,
          required: true,
          default: Date.now,
        },
        duration: {
          type: Number, // Duration in milliseconds
          required: true,
        },
        location: {
          type: [Number], // [x, y, z] coordinates
          required: false,
        },
        weapon: {
          type: String, // Associated weapon for the bounty
          required: false,
        },
        reward: {
          type: Number, // Reward amount for the bounty
          required: true,
          set: (v) => Math.round(v * 100) / 100, // Ensures reward is rounded to 2 decimal places
        },
        claimedBy: {
          type: String, // UserID of the player who claimed the bounty
          required: false,
        },
        claimedAt: {
          type: Date, // Timestamp when the bounty was claimed
          required: false,
        },
        status: {
          type: String, // 'active', 'claimed', 'expired'
          required: true,
          default: "active",
        },
        notes: {
          type: String, // Additional notes about the bounty
          required: false,
        },
      },
    ],
    completedDailyQuests: [
      {
        questID: { type: String, required: true },
        completedAt: { type: Date, required: true },
      },
    ],
    completedWeeklyQuests: [
      {
        questID: { type: String, required: true },
        completedAt: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true }
);

UserProfileSchema.index({ inGameID: 1, serviceId: 1 }, { unique: true });
UserProfileSchema.index({ gamertag: 1, serviceId: 1 }, { unique: true });
UserProfileSchema.index({ gamertag: 1, serviceId: 1, guildID: 1 });
UserProfileSchema.index({ 'altgamertag.gamertag': 1, serviceId: 1, guildID: 1 });
UserProfileSchema.index({ userID: 1, serviceId: 1, guildID: 1 });
UserProfileSchema.index({ logLastPlacement: 1, userID: 1, serviceId: 1, guildID: 1 });
UserProfileSchema.index({ factionID: 1, serviceId: 1 });
UserProfileSchema.index({ baseID: 1, serviceId: 1 });
UserProfileSchema.index({ lastSpotted: -1, guildID: 1, serviceId: 1 });

module.exports = UserProfileSchema;
