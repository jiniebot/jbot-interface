const { Schema, model } = require("mongoose");

const cooldownSchema = new Schema({
  commandName: {
    type: String,
    required: true,
  },
  userID: {
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

  factionID: {
    type: String,
    required: false,
  },
  guildID: {
    type: String,
    required: false,
  },
  endsAt: {
    type: Date,
    required: true,
  },
});

module.exports = cooldownSchema;
