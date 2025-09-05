const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingSchema = new Schema({
  provider: { 
    type: Schema.Types.ObjectId, 
    ref: 'Provider', 
    required: [true, 'Provider is required']
  },
  patient: { 
    type: Schema.Types.ObjectId, 
    ref: 'Patient', 
    required: [true, 'Patient is required']
  },
  start: { 
    type: Date, 
    required: [true, 'Start time is required'],
    validate: {
      validator: function(start) {
        return start > new Date('2020-01-01'); // Reasonable past date
      },
      message: 'Start time must be a valid future date'
    }
  },
  end: { 
    type: Date, 
    required: [true, 'End time is required'],
    validate: {
      validator: function(end) {
        return end > this.start;
      },
      message: 'End time must be after start time'
    }
  },
  status: { 
    type: String, 
    enum: {
      values: ['booked', 'cancelled', 'completed', 'no-show'],
      message: '{VALUE} is not a valid booking status'
    },
    default: 'booked'
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  reminderSent: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for optimal query performance
bookingSchema.index({ provider: 1, start: 1 });
bookingSchema.index({ patient: 1, start: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ start: 1, end: 1 });

// Compound index for booking overlap detection
bookingSchema.index({
  provider: 1,
  status: 1,
  start: 1,
  end: 1
}, {
  name: 'booking_overlap_check'
});

// Index for provider schedule lookups
bookingSchema.index({
  provider: 1,
  start: 1,
  status: 1
}, {
  name: 'provider_schedule_lookup'
});

// Virtual for duration in minutes
bookingSchema.virtual('durationMinutes').get(function() {
  return Math.round((this.end - this.start) / (1000 * 60));
});

// Virtual to check if booking is in the past
bookingSchema.virtual('isPast').get(function() {
  return this.end < new Date();
});

// Virtual to check if booking is upcoming (within 24 hours)
bookingSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return this.start > now && this.start <= in24Hours;
});

// Pre-save middleware for additional validation and business logic
bookingSchema.pre('save', function(next) {
  // Set cancellation timestamp if status changed to cancelled
  if (this.isModified('status') && this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  // Validate booking duration (5 minutes to 8 hours)
  const durationMs = this.end - this.start;
  const durationMinutes = durationMs / (1000 * 60);
  
  if (durationMinutes < 5) {
    return next(new Error('Booking duration must be at least 5 minutes'));
  }
  
  if (durationMinutes > 480) { // 8 hours
    return next(new Error('Booking duration cannot exceed 8 hours'));
  }
  
  next();
});

// Static method to find overlapping bookings
bookingSchema.statics.findOverlapping = function(providerId, start, end, excludeId = null) {
  const query = {
    provider: providerId,
    status: 'booked',
    $or: [
      {
        start: { $lt: end },
        end: { $gt: start }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.find(query);
};

// Static method to get provider's bookings for a date range
bookingSchema.statics.getProviderBookings = function(providerId, startDate, endDate, status = 'booked') {
  return this.find({
    provider: providerId,
    status,
    start: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('patient', 'first_name last_name email phone');
};

module.exports = mongoose.model('Booking', bookingSchema);
