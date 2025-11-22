const { Schema } = require("mongoose");

const RaidSchema = new Schema({
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

  attackingFaction: {
    type: String,
    required: true,
  },

  defendingFaction: {
    type: String,
    required: true,
  },

  position: {
    type: [Number],
    required: true,
  },

  startTime: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endTime: {
    type: Date,
    required: false,
  },
  active: {
    type: Boolean,
    required: true,
  },
  placedObjects: [
    {
      objectType: String,
      location: {
        x: Number,
        y: Number,
        z: Number,
      },
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  kills: [
    {
      killerID: String,
      victimID: String,
      location: {
        x: Number,
        y: Number,
        z: Number,
      },
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  deaths: [
    {
      userID: String,
      location: {
        x: Number,
        y: Number,
        z: Number,
      },
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  builtItems: [
    {
      itemType: String,
      location: {
        x: Number,
        y: Number,
        z: Number,
      },
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  dismantledItems: [
    {
      itemType: String,
      location: {
        x: Number,
        y: Number,
        z: Number,
      },
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  flagStatus: {
    type: String,
    enum: ["raised", "lowered", "captured"],
    default: "raised",
  },
  factionBankStatus: {
    attackingFaction: {
      type: Number,
      default: 0,
    },
    defendingFaction: {
      type: Number,
      default: 0,
    },
  },
});

module.exports = RaidSchema;
