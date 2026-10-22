
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: "General"
  },
  date: {
    type: Date,
    required: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  ticketsAvailable: {
    type: Number,
    min: 0,
    default: 0,
    required: true
  }
});

module.exports = mongoose.model("Event", eventSchema);
