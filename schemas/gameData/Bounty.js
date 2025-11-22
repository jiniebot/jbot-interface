const { Schema, model } = require("mongoose");

const bountySchema = new Schema(
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
    targetUserId: {
      type: String,
      required: true,
    },
    targetGamertag: {
      type: String,
      required: true,
    },
    reward: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["active", "claimed", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    lastKnownLocation: {
      type: [Number], // [x, y, z]
      default: null,
    },
    claimedBy: {
      type: String,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    evidence: {
      type: String, // URL to screenshot/video
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
bountySchema.index({ guildID: 1, serviceId: 1, status: 1 });
bountySchema.index({ targetUserId: 1, status: 1 });
bountySchema.index({ expiresAt: 1 });

// Virtual for checking if bounty is expired
bountySchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date() && this.status === "active";
});

// Method to claim bounty
bountySchema.methods.claim = function (userId) {
  this.status = "claimed";
  this.claimedBy = userId;
  this.claimedAt = new Date();
  return this.save();
};

const Bounty = model("Bounty", bountySchema);

module.exports = Bounty;
