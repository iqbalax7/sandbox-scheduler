// routes/schedule.js
const express = require("express");
const router = express.Router();
const { DateTime, Interval } = require("luxon");

const Provider = require("../models/Provider");
const Booking = require("../models/Booking");

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

// GET /api/schedule/available?providerId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get("/available", async (req, res) => {
  try {
    const { providerId, startDate, endDate } = req.query;
    if (!providerId || !startDate || !endDate) {
      return res.status(400).json({ error: "providerId, startDate, endDate required" });
    }

    const provider = await Provider.findById(providerId).lean();
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const { scheduleConfig } = provider;
    if (!scheduleConfig) {
      return res.json([]);
    }

    const tz = scheduleConfig.timezone || "UTC";
    const start = DateTime.fromISO(startDate, { zone: tz }).startOf("day");
    const end = DateTime.fromISO(endDate, { zone: tz }).endOf("day");

    // Build all slots
    let allSlots = [];

    for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
      const weekday = cursor.weekday; // Mon=1..Sun=7

      // find matching recurring rules
      const rules = (scheduleConfig.recurringRules || []).filter(r =>
        r.daysOfWeek.includes(weekday)
      );

      rules.forEach(rule => {
        const dayStart = DateTime.fromISO(`${cursor.toISODate()}T${rule.startTime}`, { zone: tz });
        const dayEnd = DateTime.fromISO(`${cursor.toISODate()}T${rule.endTime}`, { zone: tz });

        if (dayStart < dayEnd) {
          allSlots.push(...generateSlots(dayStart, dayEnd, rule.slotDuration));
        }
      });

      // apply exceptions
      const exception = (scheduleConfig.exceptions || []).find(
        e => e.date === cursor.toISODate()
      );
      if (exception) {
        if (!exception.available) {
          // blackout day: remove all slots for that day
          allSlots = allSlots.filter(s => DateTime.fromISO(s.start, { zone: tz }).toISODate() !== cursor.toISODate());
        } else if (exception.startTime && exception.endTime) {
          // add special window
          const excStart = DateTime.fromISO(`${cursor.toISODate()}T${exception.startTime}`, { zone: tz });
          const excEnd = DateTime.fromISO(`${cursor.toISODate()}T${exception.endTime}`, { zone: tz });
          allSlots.push(...generateSlots(excStart, excEnd, scheduleConfig.recurringRules?.[0]?.slotDuration || 30));
        }
      }
    }

    // enforce minNotice + maxDaysAhead
    const now = DateTime.now().setZone(tz);
    const horizon = now.plus({ days: scheduleConfig.maxDaysAhead || 365 });
    allSlots = allSlots.filter(slot => {
      const slotStart = DateTime.fromISO(slot.start, { zone: tz });
      return slotStart >= now.plus({ minutes: scheduleConfig.minNoticeMinutes || 0 }) &&
             slotStart <= horizon;
    });

    // fetch bookings
    const bookings = await Booking.find({
      provider: providerId,
      start: { $gte: start.toJSDate(), $lte: end.toJSDate() },
    }).lean();

    const bookedIntervals = bookings.map(b =>
      Interval.fromDateTimes(
        DateTime.fromJSDate(b.start).setZone(tz),
        DateTime.fromJSDate(b.end).setZone(tz)
      )
    );

    // mark booked slots
    allSlots = allSlots.map(slot => {
      const slotInterval = Interval.fromDateTimes(
        DateTime.fromISO(slot.start, { zone: tz }),
        DateTime.fromISO(slot.end, { zone: tz })
      );

      const isBooked = bookedIntervals.some(bi => bi.overlaps(slotInterval));
      return { ...slot, status: isBooked ? "booked" : "available" };
    });

    res.json(allSlots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
