const mongoose = require("mongoose");

const monitorZoneSchema = new mongoose.Schema({
  owner: { type: String, required: true },
  guildID: {
    type: String,
    required: true,
  },
  serviceId: {
    type: String,
    required: true,
  },
  name: { type: String, required: true },
  // Circular zone (for zoneType 0)
  location: {
    type: [Number], // Array for center coordinates [x, y] (optional for polygons)
    required: function () {
      return this.zoneType === 0 || this.zoneType === undefined; // Required if it's a circular zone
    },
  },
  range: {
    type: Number,
    required: function () {
      return this.zoneType === 0 || this.zoneType === undefined; // Required if it's a circular zone
    },
  },
  // Polygonal zone (for zoneType 1)
  polygon: {
    type: [
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
      },
    ],
    required: function () {
      return this.zoneType === 1; // Required if it's a polygonal zone
    },
  },
  // Zone type switch: 0 for simple (circle), 1 for complex (polygon)
  zoneType: {
    type: Number,
    required: true,
    default: 0, // Default to 0 (simple circle)
  },
  radarChannel: { type: String, required: true },
  baseID: { type: String, required: false },
  isActive: { type: Boolean, required: true, default: false },
  lifetime: { type: Number, required: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  type: { type: String, required: true },
});

const MonitorZone = mongoose.model("MonitorZone", monitorZoneSchema);

module.exports = MonitorZone;
