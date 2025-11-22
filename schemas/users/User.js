const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    discriminator: {
      type: String,
    },
    email: {
      type: String,
      sparse: true, // Allow null, but unique if present
    },
    avatar: {
      type: String,
    },
    patreonTier: {
      type: String,
      enum: ["none", "basic", "premium", "elite"],
      default: "none",
    },
    patreonId: {
      type: String,
      sparse: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    preferences: {
      theme: {
        type: String,
        enum: ["dark", "light", "auto"],
        default: "dark",
      },
      mapDefaults: {
        mapType: {
          type: String,
          enum: ["Sat", "Top"],
          default: "Sat",
        },
        zoom: {
          type: Number,
          default: 3,
        },
        layers: {
          players: { type: Boolean, default: true },
          bases: { type: Boolean, default: true },
          zones: { type: Boolean, default: false },
          spawners: { type: Boolean, default: false },
          factions: { type: Boolean, default: true },
          bounties: { type: Boolean, default: true },
          events: { type: Boolean, default: true },
        },
      },
      notifications: {
        email: { type: Boolean, default: false },
        discord: { type: Boolean, default: true },
      },
      panelOpacity: {
        type: Number,
        min: 0.3,
        max: 1,
        default: 0.8,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
userSchema.index({ discordId: 1 });
userSchema.index({ patreonId: 1 }, { sparse: true });

// Update last login on each login
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

const User = model("User", userSchema);

module.exports = User;
