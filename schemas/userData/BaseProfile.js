const { mongoose, Schema } = require("mongoose");

const BaseProfileSchema = new Schema(
  {
    owner_userID: {
      type: String,
      required: true,
    },
    guildID: {
      type: String,
      required: true,
    },
    serviceId: {
      type: String,
      required: true,
    },
    logChannel: {
      type: String,
      required: false,
    },
    baseID: {
      type: String,
      required: true,
    },

    factionID: {
      type: String,
      required: false,
    },
    flagLoc: {
      type: [Number],
      required: true,
    },
    baseName: {
      type: String,
      required: true,
      default: "Home",
    },
    dateCreated: {
      type: Date,
      required: true,
    },
    lastActive: {
      type: Date,
      required: true,
    },
    flagName: {
      type: String,
      required: false,
    },
    isAllowedFaction: {
      type: Boolean,
      required: true,
      default: false,
    },
    factionMessageSent: {
      type: Boolean,
      required: true,
      default: false,
    },
    structures: {
      type: [String],
      required: true,
    },
  },
  { timestamps: true }
);

const BaseProfile = mongoose.model("BaseProfile", BaseProfileSchema);

module.exports = BaseProfile;
