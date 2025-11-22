const mongoose = require("mongoose");

const scheduledEventSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  guildID: { type: String, required: true },
  
  serviceId: { type: String, required: true },
  name: { type: String, required: true },
  positions: [
    {
      x: Number,
      y: Number,
    },
  ],
  schedule: { type: String, required: true },

  active: { type: Boolean, required: true, default: false },
  current: { type: [Number], required: false },

  maxLoot: { type: Number, required: true },
  maxActive: { type: Number, required: true },
  order: { type: String, required: false },

  filesScenery: { type: [String], required: false },
  filesLoot: { type: [String], required: false },
});

module.exports = scheduledEventSchema;
