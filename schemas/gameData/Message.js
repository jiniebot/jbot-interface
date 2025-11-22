const mongoose = require("mongoose");

// Function to generate a 10-digit random ID
function generateRandomID() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Define the schema
const messageSchema = new mongoose.Schema({
  customID: {
    type: String,
    default: generateRandomID,
    unique: true,
  },

  userID: { type: String, required: true },
  guildID: { type: String, required: true },
  name: { type: String, required: true },

  status: {
    type: String,
    enum: ["added", "removed", "queuedAdd", "queuedRemove"],
    default: "pending",
  },
  action: {
    type: String,
    enum: ["add", "remove", "modify", "none"],
    required: true,
  },
  repeat: {
    type: Number,
    required: false,
  },
  delay: {
    type: Number,
    required: false,
  },
  onconnect: {
    type: Boolean,
    required: false,
  },
  shutdown: {
    type: Boolean,
    required: false,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = messageSchema;
