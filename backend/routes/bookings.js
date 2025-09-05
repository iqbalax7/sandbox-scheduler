const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');

const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const { asyncHandler, createNotFoundError, createConflictError, createValidationError } = require('../middleware/errorHandler');
const { validateBody, bookingSchema, isValidObjectId } = require('../utils/validation');

// Create a new booking
router.post('/', validateBody(bookingSchema), asyncHandler(async (req, res) => {
  const { providerId, patientId, start, end } = req.body;

  const provider = await Provider.findById(providerId);
  if (!provider) {
    throw createNotFoundError('Provider');
  }

  const tz = provider.scheduleConfig?.timezone || 'UTC';
  const slotStart = DateTime.fromISO(start, { zone: tz });
  const slotEnd = DateTime.fromISO(end, { zone: tz });

  // Validate time range
  if (!slotStart.isValid || !slotEnd.isValid) {
    throw createValidationError('Invalid start or end time format');
  }
  
  if (slotEnd <= slotStart) {
    throw createValidationError('End time must be after start time');
  }

  // Enforce notice period and booking horizon
  const now = DateTime.now().setZone(tz);
  const minNoticeTime = now.plus({ minutes: provider.scheduleConfig?.minNoticeMinutes || 0 });
  const horizon = now.plus({ days: provider.scheduleConfig?.maxDaysAhead || 365 });
  
  if (slotStart < minNoticeTime) {
    throw createConflictError(`Booking requires at least ${provider.scheduleConfig?.minNoticeMinutes || 0} minutes notice`);
  }
  
  if (slotStart > horizon) {
    throw createConflictError(`Booking cannot be more than ${provider.scheduleConfig?.maxDaysAhead || 365} days ahead`);
  }

  // Check for overlapping bookings
  const overlapping = await Booking.findOne({
    provider: providerId,
    status: 'booked',
    $or: [
      {
        start: { $lt: slotEnd.toJSDate() },
        end: { $gt: slotStart.toJSDate() }
      }
    ]
  });

  if (overlapping) {
    throw createConflictError('This time slot is already booked');
  }

  // Create the booking
  const booking = await Booking.create({
    provider: providerId,
    patient: patientId,
    start: slotStart.toJSDate(),
    end: slotEnd.toJSDate(),
    status: 'booked'
  });

  // Populate the booking with provider and patient details
  await booking.populate(['provider', 'patient']);

  res.status(201).json({
    success: true,
    data: booking
  });
}));

// Cancel a booking
router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw createNotFoundError('Booking');
  }

  const booking = await Booking.findById(id).populate(['provider', 'patient']);
  if (!booking) {
    throw createNotFoundError('Booking');
  }

  if (booking.status === 'cancelled') {
    throw createConflictError('Booking is already cancelled');
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();

  res.json({
    success: true,
    data: booking
  });
}));

// Get all bookings (with optional filtering)
router.get('/', asyncHandler(async (req, res) => {
  const { providerId, patientId, status, startDate, endDate } = req.query;
  
  const filter = {};
  
  if (providerId) {
    if (!isValidObjectId(providerId)) {
      throw createValidationError('Invalid provider ID');
    }
    filter.provider = providerId;
  }
  
  if (patientId) {
    if (!isValidObjectId(patientId)) {
      throw createValidationError('Invalid patient ID');
    }
    filter.patient = patientId;
  }
  
  if (status) {
    if (!['booked', 'cancelled'].includes(status)) {
      throw createValidationError('Status must be either "booked" or "cancelled"');
    }
    filter.status = status;
  }
  
  if (startDate || endDate) {
    filter.start = {};
    if (startDate) {
      const start = DateTime.fromISO(startDate);
      if (!start.isValid) {
        throw createValidationError('Invalid startDate format (ISO string required)');
      }
      filter.start.$gte = start.toJSDate();
    }
    if (endDate) {
      const end = DateTime.fromISO(endDate);
      if (!end.isValid) {
        throw createValidationError('Invalid endDate format (ISO string required)');
      }
      filter.start.$lte = end.toJSDate();
    }
  }
  
  const bookings = await Booking.find(filter)
    .populate('provider', 'name email')
    .populate('patient', 'first_name last_name email')
    .sort({ start: 1 });
  
  res.json({
    success: true,
    count: bookings.length,
    data: bookings
  });
}));

// Get a single booking
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!isValidObjectId(id)) {
    throw createNotFoundError('Booking');
  }
  
  const booking = await Booking.findById(id)
    .populate('provider', 'name email')
    .populate('patient', 'first_name last_name email');
  
  if (!booking) {
    throw createNotFoundError('Booking');
  }
  
  res.json({
    success: true,
    data: booking
  });
}));


module.exports = router;
