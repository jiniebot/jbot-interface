const { Schema, model } = require("mongoose");

const PurchaseSchema = new Schema(
  {
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
    itemID: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    factionLevel: {
      type: Number,
      required: true,
    },
    guncabinet: {
      type: Boolean,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = PurchaseSchema;
