const mongoose = require("mongoose");

const AvailabilitySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true }, // 0 = Sunday
  start: { type: String, required: true },     // "09:00"
  end: { type: String, required: true },       // "17:00"
  slotDuration: { type: Number, default: 30 }  // minutes
});

const ExceptionSchema = new mongoose.Schema({
  date: { type: String, required: true }, // "2025-08-30"
  reason: { type: String }
});

const ProviderConfigSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
  timezone: { type: String, default: "Pacific/Honolulu" },
  availability: [AvailabilitySchema],
  exceptions: [ExceptionSchema]
});

module.exports = mongoose.model("ProviderConfig", ProviderConfigSchema);
