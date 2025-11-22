const { Schema, model } = require("mongoose");

const schema = new Schema(
  {
    guildid: {
      type: String,
      required: true,
      unique: true,
    },
    services: [{ type: Object, default: [] }],
  },
  { timestamps: true }
);
const Globals = model("Globals", schema);

module.exports = Globals;
