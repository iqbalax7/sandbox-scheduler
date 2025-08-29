const mongoose = require('mongoose');
const { Schema } = mongoose;

const RecurringRuleSchema = new Schema({
  daysOfWeek: { type: [Number], default: [] }, // 1..7 (Mon=1)
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true },   // "17:00"
  slotDuration: { type: Number, required: true } // minutes
}, { _id: false });

const ExceptionSchema = new Schema({
  date: { type: String }, // "YYYY-MM-DD" provider local
  available: { type: Boolean, default: false }, // if true, this adds window
  startTime: { type: String },
  endTime: { type: String },
  note: { type: String }
}, { _id: false });

const ScheduleConfigSchema = new Schema({
  timezone: { type: String, default: 'UTC' }, // IANA tz (e.g., Pacific/Honolulu, Asia/Karachi)
  recurringRules: { type: [RecurringRuleSchema], default: [] },
  exceptions: { type: [ExceptionSchema], default: [] },
  minNoticeMinutes: { type: Number, default: 60 },
  maxDaysAhead: { type: Number, default: 365 }
}, { _id: false });

const ProviderSchema = new Schema({
  name: { type: String },
  email: { type: String },
  scheduleConfig: { type: ScheduleConfigSchema, default: () => ({}) }
}, { timestamps: true });

module.exports = mongoose.model('Provider', ProviderSchema);
