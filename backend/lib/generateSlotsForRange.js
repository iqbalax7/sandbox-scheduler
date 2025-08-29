// Luxon-based slot generator (provider tz aware)
// Returns array of { start: ISOUTC, end: ISOUTC, isBooked: Bool, booking: Booking|null }
const { DateTime } = require('luxon');
const Booking = require('../models/Booking');

function overlaps(slotStart, slotEnd, booking) {
  return slotStart < booking.end && slotEnd > booking.start;
}

/**
 * provider: Provider mongoose doc
 * fromISO/toISO: ISO UTC strings
 */
async function generateSlotsForRange(provider, fromISO, toISO) {
  const tz = (provider.scheduleConfig && provider.scheduleConfig.timezone) || 'UTC';
  const rules = (provider.scheduleConfig && provider.scheduleConfig.recurringRules) || [];
  const exceptions = (provider.scheduleConfig && provider.scheduleConfig.exceptions) || [];

  // normalize requested UTC range to provider local days
  const fromUtcDT = DateTime.fromISO(fromISO, { zone: 'utc' });
  const toUtcDT = DateTime.fromISO(toISO, { zone: 'utc' });

  const fromLocalStart = fromUtcDT.setZone(tz).startOf('day');
  const toLocalEnd = toUtcDT.setZone(tz).endOf('day');

  // compute UTC bounds to fetch bookings that might overlap
  const utcFetchStart = fromLocalStart.setZone('utc').toJSDate();
  const utcFetchEnd = toLocalEnd.setZone('utc').toJSDate();

  const bookings = await Booking.find({
    providerId: provider._id,
    start: { $lt: utcFetchEnd },
    end: { $gt: utcFetchStart }
  }).lean();

  const slots = [];

  for (let day = fromLocalStart; day <= toLocalEnd; day = day.plus({ days: 1 })) {
    const dateStr = day.toISODate(); // YYYY-MM-DD in provider tz
    const weekday = day.weekday; // 1..7

    // if full-day unavailable exception -> skip
    if (exceptions.some(e => e.date === dateStr && e.available === false)) {
      continue;
    }

    // generate from rules
    for (const rule of rules) {
      if (!Array.isArray(rule.daysOfWeek) || !rule.daysOfWeek.includes(weekday)) continue;

      const dayStart = DateTime.fromISO(`${dateStr}T${rule.startTime}`, { zone: tz });
      const dayEnd = DateTime.fromISO(`${dateStr}T${rule.endTime}`, { zone: tz });
      const dur = rule.slotDuration || 30;

      let cursor = dayStart;
      while (cursor.plus({ minutes: dur }) <= dayEnd) {
        const slotStartLocal = cursor;
        const slotEndLocal = cursor.plus({ minutes: dur });

        const slotStartUtc = slotStartLocal.setZone('utc').toJSDate();
        const slotEndUtc = slotEndLocal.setZone('utc').toJSDate();

        const overlapping = bookings.find(b => overlaps(slotStartUtc, slotEndUtc, b));

        slots.push({
          start: slotStartLocal.setZone('utc').toISO(),
          end: slotEndLocal.setZone('utc').toISO(),
          isBooked: !!overlapping,
          booking: overlapping || null
        });

        cursor = cursor.plus({ minutes: dur });
      }
    }

    // handle exception windows that add availability on a single date
    for (const ex of exceptions.filter(e => e.date === dateStr && e.available && e.startTime && e.endTime)) {
      const exStart = DateTime.fromISO(`${dateStr}T${ex.startTime}`, { zone: tz });
      const exEnd = DateTime.fromISO(`${dateStr}T${ex.endTime}`, { zone: tz });
      // fallback slot duration to first rule or 30
      const dur = (rules[0] && rules[0].slotDuration) || 30;
      let c = exStart;
      while (c.plus({ minutes: dur }) <= exEnd) {
        const sUtc = c.setZone('utc').toJSDate();
        const eUtc = c.plus({ minutes: dur }).setZone('utc').toJSDate();
        const overlapping = bookings.find(b => overlaps(sUtc, eUtc, b));
        slots.push({
          start: c.setZone('utc').toISO(),
          end: c.plus({ minutes: dur }).setZone('utc').toISO(),
          isBooked: !!overlapping,
          booking: overlapping || null
        });
        c = c.plus({ minutes: dur });
      }
    }
  }

  // dedupe & sort (in case of overlaps from rules + exceptions)
  slots.sort((a, b) => new Date(a.start) - new Date(b.start));
  return slots;
}

module.exports = generateSlotsForRange;
