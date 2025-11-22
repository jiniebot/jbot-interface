const { Schema } = require("mongoose");

const AdminTicketSchema = new Schema(
  {
    userID: {
      type: String,
      required: true,
    },
    channelID: {
      type: String,
      required: true,
    },
    serviceId: {
      type: String,
      required: true,
    },
    guildID: {
      type: String,
      required: true,
    },
    ticketNum: {
      type: Number,
      required: true,
      default: 1,
    },
    closed: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = AdminTicketSchema;
