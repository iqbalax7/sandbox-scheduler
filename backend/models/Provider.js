const mongoose = require('mongoose');
const { Schema } = mongoose;

const RecurringRuleSchema = new Schema({
  daysOfWeek: { 
    type: [Number], 
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(day => day >= 1 && day <= 7);
      },
      message: 'Days of week must be numbers between 1-7 (Monday=1, Sunday=7)'
    }
  },
  startTime: { 
    type: String, 
    required: true,
    validate: {
      validator: function(time) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'Start time must be in HH:MM format (24-hour)'
    }
  },
  endTime: { 
    type: String, 
    required: true,
    validate: {
      validator: function(time) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'End time must be in HH:MM format (24-hour)'
    }
  },
  slotDuration: { 
    type: Number, 
    required: true,
    min: [5, 'Slot duration must be at least 5 minutes'],
    max: [480, 'Slot duration cannot exceed 8 hours']
  }
}, { _id: false });

const ExceptionSchema = new Schema({
  date: { 
    type: String, 
    required: true,
    validate: {
      validator: function(date) {
        return /^\d{4}-\d{2}-\d{2}$/.test(date);
      },
      message: 'Date must be in YYYY-MM-DD format'
    }
  },
  available: { 
    type: Boolean, 
    default: false 
  },
  startTime: { 
    type: String,
    validate: {
      validator: function(time) {
        return !time || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'Start time must be in HH:MM format (24-hour)'
    }
  },
  endTime: { 
    type: String,
    validate: {
      validator: function(time) {
        return !time || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'End time must be in HH:MM format (24-hour)'
    }
  },
  note: { 
    type: String,
    maxlength: [500, 'Exception note cannot exceed 500 characters']
  }
}, { _id: false });

const ScheduleConfigSchema = new Schema({
  timezone: { 
    type: String, 
    default: 'UTC',
    validate: {
      validator: function(tz) {
        try {
          // Check if timezone is valid by creating a date with it
          new Date().toLocaleString('en-US', { timeZone: tz });
          return true;
        } catch (e) {
          return false;
        }
      },
      message: 'Invalid timezone identifier'
    }
  },
  recurringRules: { 
    type: [RecurringRuleSchema], 
    default: [],
    validate: {
      validator: function(rules) {
        return rules.length <= 20; // Reasonable limit
      },
      message: 'Cannot have more than 20 recurring rules'
    }
  },
  exceptions: { 
    type: [ExceptionSchema], 
    default: [],
    validate: {
      validator: function(exceptions) {
        return exceptions.length <= 365; // One year worth of exceptions
      },
      message: 'Cannot have more than 365 exceptions'
    }
  },
  minNoticeMinutes: { 
    type: Number, 
    default: 60,
    min: [0, 'Minimum notice cannot be negative'],
    max: [10080, 'Minimum notice cannot exceed one week']
  },
  maxDaysAhead: { 
    type: Number, 
    default: 365,
    min: [1, 'Max days ahead must be at least 1'],
    max: [730, 'Max days ahead cannot exceed 2 years']
  }
}, { _id: false });

const ProviderSchema = new Schema({
  name: { 
    type: String, 
    required: [true, 'Provider name is required'],
    trim: true,
    minlength: [2, 'Provider name must be at least 2 characters'],
    maxlength: [100, 'Provider name cannot exceed 100 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Provider email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  scheduleConfig: { 
    type: ScheduleConfigSchema, 
    default: () => ({})
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes
ProviderSchema.index({ email: 1 }, { unique: true });
ProviderSchema.index({ name: 1 });
ProviderSchema.index({ isActive: 1 });
ProviderSchema.index({ 'scheduleConfig.timezone': 1 });

// Virtual for full schedule info
ProviderSchema.virtual('hasSchedule').get(function() {
  return this.scheduleConfig && this.scheduleConfig.recurringRules && this.scheduleConfig.recurringRules.length > 0;
});

// Pre-save middleware for additional validation
ProviderSchema.pre('save', function(next) {
  // Validate that recurring rules make sense
  if (this.scheduleConfig && this.scheduleConfig.recurringRules) {
    for (const rule of this.scheduleConfig.recurringRules) {
      const [startHour, startMin] = rule.startTime.split(':').map(Number);
      const [endHour, endMin] = rule.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (endMinutes <= startMinutes) {
        return next(new Error('End time must be after start time in recurring rules'));
      }
    }
  }
  next();
});

module.exports = mongoose.model('Provider', ProviderSchema);
