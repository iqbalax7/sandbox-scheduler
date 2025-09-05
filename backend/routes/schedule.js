const express = require('express');
const router = express.Router();
const { DateTime, Interval } = require('luxon');

const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const { asyncHandler, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const { isValidObjectId, isValidDateString } = require('../utils/validation');

// helper: generate time slots within [start, end)
function generateSlots(startDateTime, endDateTime, slotMinutes) {
  const slots = [];
  let cursor = startDateTime;
  while (cursor < endDateTime) {
    const next = cursor.plus({ minutes: slotMinutes });
    slots.push({
      start: cursor.toISO(),
      end: next.toISO(),
      status: "available", // default
    });
    cursor = next;
  }
  return slots;
}

// Get available slots for a provider within a date range
router.get('/available', asyncHandler(async (req, res) => {
  const { providerId, startDate, endDate } = req.query;
  
  if (!providerId || !startDate || !endDate) {
    throw createValidationError('providerId, startDate, and endDate query parameters are required');
  }
  
  if (!isValidObjectId(providerId)) {
    throw createValidationError('Invalid provider ID format');
  }
  
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw createValidationError('Date format must be YYYY-MM-DD');
  }
  
  const provider = await Provider.findById(providerId).lean();
  if (!provider) {
    throw createNotFoundError('Provider');
  }

  const { scheduleConfig } = provider;
  if (!scheduleConfig || !scheduleConfig.recurringRules?.length) {
    return res.json({
      success: true,
      data: {
        provider: {
          _id: provider._id,
          name: provider.name
        },
        slots: [],
        message: 'No schedule configuration found for this provider'
      }
    });
  }
  
  const tz = scheduleConfig.timezone || 'UTC';
  const start = DateTime.fromISO(startDate, { zone: tz }).startOf('day');
  const end = DateTime.fromISO(endDate, { zone: tz }).endOf('day');
  
  if (!start.isValid || !end.isValid) {
    throw createValidationError('Invalid date format');
  }
  
  if (end < start) {
    throw createValidationError('End date must be after start date');
  }

  // Build all slots
  let allSlots = [];

  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    const weekday = cursor.weekday; // Mon=1..Sun=7

    // Find matching recurring rules
    const rules = (scheduleConfig.recurringRules || []).filter(r =>
      Array.isArray(r.daysOfWeek) && r.daysOfWeek.includes(weekday)
    );

    rules.forEach(rule => {
      if (!rule.startTime || !rule.endTime || !rule.slotDuration) {
        console.warn(`Invalid rule for provider ${providerId}:`, rule);
        return;
      }
      
      const dayStart = DateTime.fromISO(`${cursor.toISODate()}T${rule.startTime}`, { zone: tz });
      const dayEnd = DateTime.fromISO(`${cursor.toISODate()}T${rule.endTime}`, { zone: tz });

      if (dayStart.isValid && dayEnd.isValid && dayStart < dayEnd) {
        allSlots.push(...generateSlots(dayStart, dayEnd, rule.slotDuration));
      }
    });

    // Apply exceptions
    const exception = (scheduleConfig.exceptions || []).find(
      e => e.date === cursor.toISODate()
    );
    
    if (exception) {
      if (!exception.available) {
        // Blackout day: remove all slots for that day
        allSlots = allSlots.filter(s => 
          DateTime.fromISO(s.start, { zone: tz }).toISODate() !== cursor.toISODate()
        );
      } else if (exception.startTime && exception.endTime) {
        // Add special availability window
        const excStart = DateTime.fromISO(`${cursor.toISODate()}T${exception.startTime}`, { zone: tz });
        const excEnd = DateTime.fromISO(`${cursor.toISODate()}T${exception.endTime}`, { zone: tz });
        
        if (excStart.isValid && excEnd.isValid && excStart < excEnd) {
          const slotDuration = scheduleConfig.recurringRules?.[0]?.slotDuration || 30;
          allSlots.push(...generateSlots(excStart, excEnd, slotDuration));
        }
      }
    }
  }

  // Enforce notice period and booking horizon
  const now = DateTime.now().setZone(tz);
  const minNoticeTime = now.plus({ minutes: scheduleConfig.minNoticeMinutes || 0 });
  const horizon = now.plus({ days: scheduleConfig.maxDaysAhead || 365 });
  
  allSlots = allSlots.filter(slot => {
    const slotStart = DateTime.fromISO(slot.start, { zone: tz });
    return slotStart.isValid && 
           slotStart >= minNoticeTime && 
           slotStart <= horizon;
  });

  // Fetch existing bookings
  const bookings = await Booking.find({
    provider: providerId,
    status: 'booked',
    start: { 
      $gte: start.toJSDate(), 
      $lte: end.toJSDate() 
    }
  }).lean();

  const bookedIntervals = bookings.map(b =>
    Interval.fromDateTimes(
      DateTime.fromJSDate(b.start).setZone(tz),
      DateTime.fromJSDate(b.end).setZone(tz)
    )
  );

  // Mark booked slots
  allSlots = allSlots.map(slot => {
    const slotInterval = Interval.fromDateTimes(
      DateTime.fromISO(slot.start, { zone: tz }),
      DateTime.fromISO(slot.end, { zone: tz })
    );

    const isBooked = bookedIntervals.some(bi => bi.overlaps(slotInterval));
    return { 
      ...slot, 
      status: isBooked ? 'booked' : 'available' 
    };
  });

  // Sort slots by start time
  allSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

  res.json({
    success: true,
    data: {
      provider: {
        _id: provider._id,
        name: provider.name,
        timezone: tz
      },
      dateRange: {
        startDate,
        endDate
      },
      slots: allSlots,
      summary: {
        totalSlots: allSlots.length,
        availableSlots: allSlots.filter(s => s.status === 'available').length,
        bookedSlots: allSlots.filter(s => s.status === 'booked').length
      }
    }
  });
}));

module.exports = router;
