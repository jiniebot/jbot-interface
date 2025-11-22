const { Schema } = require("mongoose");

const FactionProfileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      required: false,
    },
    guildID: {
      type: String,
      required: true,
    },
    serviceId: {
      type: String,
      required: true,
    },
    owner_userID: {
      type: String,
      required: true,
    },
    co_owner_userID: {
      type: [String],
      required: false,
    },
    member_userID: {
      type: [String],
      required: false,
    },
    hasMembers: {
      type: Boolean,
      required: false,
    },
    factionID: {
      type: String,
      required: true,
    },
    guildID: {
      type: String,
      required: false,
    },
    baseID: {
      type: [String],
      required: true,
    },
    structures: {
      type: [String],
      required: true,
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
      required: true,
    },
    armbandName: {
      type: String,
      required: true,
    },
    factionBank: {
      type: Map,
      of: Number,
    },
    isAddingBase: { type: Boolean, required: false, default: false },
    newBasePos: {
      type: [Number],
      required: false,
    },
    newBasePos: {
      type: [Number],
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = FactionProfileSchema;
