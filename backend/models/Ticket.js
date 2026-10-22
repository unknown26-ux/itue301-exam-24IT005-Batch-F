
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  attendeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attendee",
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true
  },
  quantity: {
    type: Number,
    min: 1,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: "Quantity must be a whole number"
    }
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["booked", "cancelled", "used"],
    default: "booked"
  }
});

module.exports = mongoose.model("Ticket", ticketSchema);
