const { Schema } = require("mongoose");

const QuestSchema = new Schema(
  {
    userID: {
      type: String,
      required: true,
    },
    guildID: {
      type: String,
      required: true,
    },
    type: { //kill, fireplace, npckill, rob, factionkill, qrcode, bleed. 
      type: String,
      required: true,
    },
    dateAccepted: {
      type: Date,
      required: true,
    },
    dateEnd: {
      type: Date,
      required: true,
    },
    name: { type: String, required: true },

    description: { type: String, required: true },

    criteria: {
      type: Map,
      of: Schema.Types.Mixed
      // Example: { killCount: 10, collectItem: 'GoldCoin' }
  },
  rewards: {
      xp: Number,
      items: [{ itemName: String, itemCount: Number }],
      // Add other reward types as needed
  },
    isActive: Boolean,
    completionStatus: {
      isCompleted: Boolean,
      completedBy: [String], // Array of userIDs who have completed the quest
    },
  },
  { timestamps: true }
);

module.exports = QuestSchema;
