const { Schema, model } = require("mongoose");

const flagSchema = new Schema({
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
  claimed: {
    type: Boolean,
    required: true,
    default: false,
  },
  flagName: {
    type: String,
    required: true,
  },
  factionID: {
    type: String,
    required: false,
  },
  baseID: {
    type: String,
    required: false,
  },
  guildID: {
    type: String,
    required: false,
  },
  pos: {
    type: [Number],
    required: true,
  },
  raisedDate: {
    type: Date,
    required: true,
  },
  isRaised: {
    type: Boolean,
    required: false,
  },
});

module.exports = flagSchema;
