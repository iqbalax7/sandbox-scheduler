const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },

  start: { type: Date, required: true }, // UTC instant
  end: { type: Date, required: true },   // UTC instant

  status: { type: String, enum: ["booked", "cancelled"], default: "booked" }
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
