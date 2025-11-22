const { Schema, model } = require("mongoose");

const activeObjSpSchema = new Schema({
  owner_userID: {
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
  fileName: {
    type: String,
    required: true,
  },
  pos: {
    type: [Number],
    required: true,
  },
  rotation: {
    type: Number,
    required: true,
  },
  flat: {
    type: Boolean,
    required: true,
  },
  dateCreated: {
    type: Date,
    required: true,
  },
  lifetime: {
    type: Number,
    required: true,
    default: -1,
  },
  itemID: {
    type: String,
    required: true,
    default: "Admin",
  },
  doorState: {
    type: Boolean,
    required: false,
  },
  isActive: {
    type: Boolean,
    required: true,
  },
  inUse: {
    type: Boolean,
    required: true,
    default: false,
  },
  userLastNear: {
    type: Date,
    required: false,
  },
});

const ActiveObjSp = model("ActiveObjSp", activeObjSpSchema);

module.exports = ActiveObjSp;
