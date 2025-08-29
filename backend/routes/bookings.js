// routes/booking.js
const express = require("express");
const router = express.Router();
const { DateTime, Interval } = require("luxon");

const Provider = require("../models/Provider");
const Booking = require("../models/Booking");

// POST /api/booking
// body: { providerId, patientId, start, end }
router.post("/", async (req, res) => {
  try {
    const { providerId, patientId, start, end } = req.body;

    if (!providerId || !patientId || !start || !end) {
      return res.status(400).json({ error: "providerId, patientId, start, end required" });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const tz = provider.scheduleConfig?.timezone || "UTC";
    const slotStart = DateTime.fromISO(start, { zone: tz });
    const slotEnd = DateTime.fromISO(end, { zone: tz });

    // basic validation
    if (!slotStart.isValid || !slotEnd.isValid || slotEnd <= slotStart) {
      return res.status(400).json({ error: "Invalid start/end time" });
    }

    // enforce minNotice + horizon
    const now = DateTime.now().setZone(tz);
    const horizon = now.plus({ days: provider.scheduleConfig.maxDaysAhead || 365 });
    if (slotStart < now.plus({ minutes: provider.scheduleConfig.minNoticeMinutes || 0 })) {
      return res.status(400).json({ error: "Too soon to book this slot" });
    }
    if (slotStart > horizon) {
      return res.status(400).json({ error: "Too far ahead to book this slot" });
    }

    // check overlap with existing bookings
    const overlapping = await Booking.findOne({
      provider: providerId,
      $or: [
        { start: { $lt: slotEnd.toJSDate() }, end: { $gt: slotStart.toJSDate() } },
      ],
    });

    if (overlapping) {
      return res.status(400).json({ error: "Slot already booked" });
    }

    // save booking
    const booking = new Booking({
      provider: providerId,
      patient: patientId,
      start: slotStart.toJSDate(),
      end: slotEnd.toJSDate(),
      status: "booked",
    });

    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/booking/:id/cancel
router.patch("/:id/cancel", async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking already cancelled" });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
