const { Schema } = require("mongoose");

const FactionTicketSchema = new Schema(
  {
    userID: {
      type: String,
      required: true,
    },
    channelID: {
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
    ticketNum: {
      type: Number,
      required: true,
      default: 1,
    },
    flagPos: {
      type: [Number],
      required: false,
    },
    closed: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = FactionTicketSchema;
