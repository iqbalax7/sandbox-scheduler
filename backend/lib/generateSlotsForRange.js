/**
 * Enhanced timezone-aware slot generator
 * Returns array of { start: ISO_UTC, end: ISO_UTC, isBooked: Boolean, booking: Booking|null }
 * 
 * Features:
 * - Proper timezone handling with validation
 * - Notice period and booking horizon enforcement  
 * - Duplicate slot detection and removal
 * - Exception handling (blackouts and special availability)
 * - Performance optimizations
 */
const { DateTime } = require('luxon');
const Booking = require('../models/Booking');

/**
 * Check if two time ranges overlap
 * @param {Date|DateTime} slotStart 
 * @param {Date|DateTime} slotEnd 
 * @param {Object} booking 
 * @returns {boolean}
 */
function overlaps(slotStart, slotEnd, booking) {
  const start = slotStart instanceof DateTime ? slotStart.toJSDate() : slotStart;
  const end = slotEnd instanceof DateTime ? slotEnd.toJSDate() : slotEnd;
  return start < booking.end && end > booking.start;
}

/**
 * Remove duplicate slots based on start/end times
 * @param {Array} slots 
 * @returns {Array}
 */
function removeDuplicateSlots(slots) {
  const seen = new Set();
  return slots.filter(slot => {
    const key = `${slot.start}-${slot.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Validate timezone and date inputs
 * @param {string} tz 
 * @param {string} fromISO 
 * @param {string} toISO 
 * @throws {Error} If validation fails
 */
function validateInputs(tz, fromISO, toISO) {
  // Validate timezone
  try {
    DateTime.now().setZone(tz);
  } catch (error) {
    throw new Error(`Invalid timezone: ${tz}`);
  }
  
  // Validate ISO dates
  const fromDT = DateTime.fromISO(fromISO, { zone: 'utc' });
  const toDT = DateTime.fromISO(toISO, { zone: 'utc' });
  
  if (!fromDT.isValid) {
    throw new Error(`Invalid fromISO date: ${fromISO}`);
  }
  
  if (!toDT.isValid) {
    throw new Error(`Invalid toISO date: ${toISO}`);
  }
  
  if (toDT <= fromDT) {
    throw new Error('End date must be after start date');
  }
  
  // Prevent excessively large date ranges (performance protection)
  const daysDiff = toDT.diff(fromDT, 'days').days;
  if (daysDiff > 90) {
    throw new Error('Date range cannot exceed 90 days');
  }
}

/**
 * Generate available time slots for a provider within a date range
 * @param {Object} provider - Provider mongoose document
 * @param {string} fromISO - Start date in ISO UTC format
 * @param {string} toISO - End date in ISO UTC format
 * @returns {Promise<Array>} Array of slot objects
 */
async function generateSlotsForRange(provider, fromISO, toISO) {
  if (!provider || !provider._id) {
    throw new Error('Provider is required');
  }
  
  const scheduleConfig = provider.scheduleConfig || {};
  const tz = scheduleConfig.timezone || 'UTC';
  const rules = scheduleConfig.recurringRules || [];
  const exceptions = scheduleConfig.exceptions || [];
  const minNoticeMinutes = scheduleConfig.minNoticeMinutes || 0;
  const maxDaysAhead = scheduleConfig.maxDaysAhead || 365;
  
  // Validate inputs
  validateInputs(tz, fromISO, toISO);
  
  // No rules = no availability
  if (rules.length === 0) {
    return [];
  }

  // Convert UTC range to provider's local timezone for day-based processing
  const fromUtcDT = DateTime.fromISO(fromISO, { zone: 'utc' });
  const toUtcDT = DateTime.fromISO(toISO, { zone: 'utc' });
  
  const fromLocalStart = fromUtcDT.setZone(tz).startOf('day');
  const toLocalEnd = toUtcDT.setZone(tz).endOf('day');
  
  // Calculate notice period and booking horizon constraints
  const now = DateTime.now().setZone(tz);
  const earliestBookingTime = now.plus({ minutes: minNoticeMinutes });
  const latestBookingTime = now.plus({ days: maxDaysAhead });
  
  // Expand fetch range to ensure we catch all potentially overlapping bookings
  const utcFetchStart = fromLocalStart.minus({ days: 1 }).setZone('utc').toJSDate();
  const utcFetchEnd = toLocalEnd.plus({ days: 1 }).setZone('utc').toJSDate();
  
  // Fetch existing bookings with better query
  const bookings = await Booking.find({
    provider: provider._id, // Fixed: was providerId, should be provider
    status: 'booked', // Only consider booked appointments
    start: { $lt: utcFetchEnd },
    end: { $gt: utcFetchStart }
  }).lean();
  
  console.log(`Found ${bookings.length} existing bookings for provider ${provider._id}`);

  const slots = [];
  
  // Process each day in the requested range
  for (let day = fromLocalStart; day <= toLocalEnd; day = day.plus({ days: 1 })) {
    const dateStr = day.toISODate(); // YYYY-MM-DD in provider timezone
    const weekday = day.weekday; // 1=Monday, 7=Sunday
    
    // Check for full-day blackout exception
    const blackoutException = exceptions.find(e => 
      e.date === dateStr && e.available === false
    );
    
    if (blackoutException) {
      console.log(`Skipping ${dateStr} due to blackout: ${blackoutException.note || 'No reason specified'}`);
      continue;
    }
    
    // Generate slots from recurring rules
    for (const rule of rules) {
      // Validate rule structure
      if (!rule.daysOfWeek || !Array.isArray(rule.daysOfWeek)) {
        console.warn('Invalid rule - missing or invalid daysOfWeek:', rule);
        continue;
      }
      
      if (!rule.daysOfWeek.includes(weekday)) {
        continue; // Rule doesn't apply to this weekday
      }
      
      if (!rule.startTime || !rule.endTime || !rule.slotDuration) {
        console.warn('Invalid rule - missing required fields:', rule);
        continue;
      }
      
      // Parse rule times
      const dayStart = DateTime.fromISO(`${dateStr}T${rule.startTime}`, { zone: tz });
      const dayEnd = DateTime.fromISO(`${dateStr}T${rule.endTime}`, { zone: tz });
      
      if (!dayStart.isValid || !dayEnd.isValid) {
        console.warn(`Invalid time format in rule for ${dateStr}:`, rule);
        continue;
      }
      
      if (dayStart >= dayEnd) {
        console.warn(`Invalid time range in rule for ${dateStr} (start >= end):`, rule);
        continue;
      }
      
      const slotDuration = rule.slotDuration;
      
      // Generate slots for this rule
      let cursor = dayStart;
      while (cursor.plus({ minutes: slotDuration }) <= dayEnd) {
        const slotStartLocal = cursor;
        const slotEndLocal = cursor.plus({ minutes: slotDuration });
        
        // Apply notice period and horizon constraints
        if (slotStartLocal < earliestBookingTime || slotStartLocal > latestBookingTime) {
          cursor = cursor.plus({ minutes: slotDuration });
          continue;
        }
        
        // Check for overlapping bookings
        const overlappingBooking = bookings.find(booking => 
          overlaps(slotStartLocal, slotEndLocal, booking)
        );
        
        slots.push({
          start: slotStartLocal.setZone('utc').toISO(),
          end: slotEndLocal.setZone('utc').toISO(),
          isBooked: !!overlappingBooking,
          booking: overlappingBooking || null,
          providerTimezone: tz,
          localStart: slotStartLocal.toISO(),
          localEnd: slotEndLocal.toISO()
        });
        
        cursor = cursor.plus({ minutes: slotDuration });
      }
    }
    
    // Handle special availability exceptions
    const availabilityExceptions = exceptions.filter(e => 
      e.date === dateStr && e.available === true && e.startTime && e.endTime
    );
    
    for (const exception of availabilityExceptions) {
      const exStart = DateTime.fromISO(`${dateStr}T${exception.startTime}`, { zone: tz });
      const exEnd = DateTime.fromISO(`${dateStr}T${exception.endTime}`, { zone: tz });
      
      if (!exStart.isValid || !exEnd.isValid) {
        console.warn(`Invalid exception time format for ${dateStr}:`, exception);
        continue;
      }
      
      if (exStart >= exEnd) {
        console.warn(`Invalid exception time range for ${dateStr}:`, exception);
        continue;
      }
      
      // Use first rule's slot duration or default to 30 minutes
      const slotDuration = (rules[0] && rules[0].slotDuration) || 30;
      
      let cursor = exStart;
      while (cursor.plus({ minutes: slotDuration }) <= exEnd) {
        const slotStartLocal = cursor;
        const slotEndLocal = cursor.plus({ minutes: slotDuration });
        
        // Apply notice period and horizon constraints
        if (slotStartLocal < earliestBookingTime || slotStartLocal > latestBookingTime) {
          cursor = cursor.plus({ minutes: slotDuration });
          continue;
        }
        
        // Check for overlapping bookings
        const overlappingBooking = bookings.find(booking => 
          overlaps(slotStartLocal, slotEndLocal, booking)
        );
        
        slots.push({
          start: slotStartLocal.setZone('utc').toISO(),
          end: slotEndLocal.setZone('utc').toISO(),
          isBooked: !!overlappingBooking,
          booking: overlappingBooking || null,
          providerTimezone: tz,
          localStart: slotStartLocal.toISO(),
          localEnd: slotEndLocal.toISO(),
          isException: true,
          exceptionNote: exception.note
        });
        
        cursor = cursor.plus({ minutes: slotDuration });
      }
    }
  }

  // Remove duplicate slots and sort
  const uniqueSlots = removeDuplicateSlots(slots);
  uniqueSlots.sort((a, b) => new Date(a.start) - new Date(b.start));
  
  console.log(`Generated ${uniqueSlots.length} unique slots for provider ${provider._id}`);
  
  return uniqueSlots;
}

module.exports = generateSlotsForRange;
