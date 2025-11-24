const { Schema, model } = require("mongoose");

const ShopItemSchema = new Schema(
  {
    itemID: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    guildID: {
      type: String,
      required: true,
    },
    serviceId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      sparse: true,
    },
    fileNameFlat: {
      type: String,
      required: false,
      sparse: true,
    },
    description: {
      type: String,
      default: "An Item",
    },
    addedBy: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: false,
    },
    postedDate: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    maxQuantity: {
      type: Number,
      required: true,
      default: 1,
    },
    lifetime: {
      type: Number,
      required: true,
    },
    shopCategory: {
      type: String,
      required: true,
    },
    itemCategory: {
      type: Number,
      required: true,
    },
    imagePath: {
      type: String,
      required: false,
    },
    factionLevel: {
      type: Number,
      required: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = ShopItemSchema;
