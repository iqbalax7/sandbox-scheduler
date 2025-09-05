const mongoose = require('mongoose');
const { Schema } = mongoose;

const PatientSchema = new Schema({
  first_name: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [1, 'First name must be at least 1 character'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  last_name: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [1, 'Last name must be at least 1 character'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
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
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(phone) {
        return !phone || /^[\+]?[1-9][\d\s\-\(\)]{7,15}$/.test(phone);
      },
      message: 'Please provide a valid phone number'
    }
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(date) {
        return !date || date <= new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
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
PatientSchema.index({ email: 1 }, { unique: true });
PatientSchema.index({ last_name: 1, first_name: 1 });
PatientSchema.index({ isActive: 1 });

// Text index for search functionality
PatientSchema.index({
  first_name: 'text',
  last_name: 'text',
  email: 'text'
}, {
  weights: {
    first_name: 3,
    last_name: 3,
    email: 2
  }
});

// Virtual for full name
PatientSchema.virtual('fullName').get(function() {
  return `${this.first_name} ${this.last_name}`;
});

// Virtual for age (if date of birth is provided)
PatientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

module.exports = mongoose.model('Patient', PatientSchema);
