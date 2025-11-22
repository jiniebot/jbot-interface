const { Schema, model } = require("mongoose");

const dynamicEventSchema = new Schema(
  {
    guildID: {
      type: String,
      required: true,
      index: true,
    },
    serviceId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "airdrop",
        "heli_crash",
        "convoy",
        "trader",
        "zombie_horde",
        "treasure_hunt",
        "king_of_the_hill",
        "custom",
      ],
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    location: {
      type: [Number], // [x, y, z]
      required: true,
    },
    radius: {
      type: Number,
      required: true,
      min: 10,
      max: 5000,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // minutes
      required: true,
      min: 5,
      max: 1440, // 24 hours
    },
    rewards: {
      items: [
        {
          name: String,
          quantity: Number,
        },
      ],
      currency: Number,
      experience: Number,
    },
    participants: [
      {
        userId: String,
        gamertag: String,
        joinedAt: Date,
        score: { type: Number, default: 0 },
      },
    ],
    winner: {
      userId: String,
      gamertag: String,
    },
    status: {
      type: String,
      enum: ["scheduled", "active", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    recurrence: {
      enabled: { type: Boolean, default: false },
      pattern: {
        type: String,
        enum: ["daily", "weekly", "monthly", "custom"],
      },
      nextOccurrence: Date,
    },
    settings: {
      maxParticipants: { type: Number, default: 0 }, // 0 = unlimited
      requireRegistration: { type: Boolean, default: false },
      announceChannel: String,
      autoStart: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Compound indexes
dynamicEventSchema.index({ guildID: 1, serviceId: 1, status: 1 });
dynamicEventSchema.index({ startTime: 1, status: 1 });
dynamicEventSchema.index({ eventType: 1, isActive: 1 });

// Virtual for checking if event is ongoing
dynamicEventSchema.virtual("isOngoing").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    this.startTime <= now &&
    (!this.endTime || this.endTime >= now)
  );
});

// Method to start event
dynamicEventSchema.methods.start = function () {
  this.status = "active";
  this.isActive = true;
  this.startTime = new Date();
  this.endTime = new Date(Date.now() + this.duration * 60 * 1000);
  return this.save();
};

// Method to end event
dynamicEventSchema.methods.end = function () {
  this.status = "completed";
  this.isActive = false;
  this.endTime = new Date();
  return this.save();
};

// Method to add participant
dynamicEventSchema.methods.addParticipant = function (userId, gamertag) {
  if (!this.participants.find((p) => p.userId === userId)) {
    this.participants.push({
      userId,
      gamertag,
      joinedAt: new Date(),
      score: 0,
    });
  }
  return this.save();
};

const DynamicEvent = model("DynamicEvent", dynamicEventSchema);

module.exports = DynamicEvent;
