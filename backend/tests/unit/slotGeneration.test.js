const { DateTime } = require('luxon');
const generateSlotsForRange = require('../../lib/generateSlotsForRange');

describe('Slot Generation', () => {
  let testProvider;
  let testPatient;

  beforeEach(async () => {
    testProvider = await createTestProvider();
    testPatient = await createTestPatient();
  });

  describe('Input validation', () => {
    test('should throw error for invalid provider', async () => {
      const from = DateTime.now().toISODate();
      const to = DateTime.now().plus({ days: 1 }).toISODate();

      await expect(generateSlotsForRange(null, from, to)).rejects.toThrow('Provider is required');
    });

    test('should throw error for invalid date range', async () => {
      const from = DateTime.now().plus({ days: 1 }).toISODate();
      const to = DateTime.now().toISODate(); // End before start

      await expect(generateSlotsForRange(testProvider, from, to)).rejects.toThrow('End date must be after start date');
    });

    test('should throw error for excessively large date range', async () => {
      const from = DateTime.now().toISODate();
      const to = DateTime.now().plus({ days: 100 }).toISODate();

      await expect(generateSlotsForRange(testProvider, from, to)).rejects.toThrow('Date range cannot exceed 90 days');
    });

    test('should throw error for invalid timezone', async () => {
      const provider = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          timezone: 'Invalid/Timezone'
        }
      });

      const from = DateTime.now().toISODate();
      const to = DateTime.now().plus({ days: 1 }).toISODate();

      await expect(generateSlotsForRange(provider, from, to)).rejects.toThrow('Invalid timezone');
    });
  });

  describe('Basic slot generation', () => {
    test('should generate slots for a basic schedule', async () => {
      const from = DateTime.now().plus({ days: 1 }).toISODate();
      const to = DateTime.now().plus({ days: 1 }).toISODate();

      const slots = await generateSlotsForRange(testProvider, from, to);

      expect(slots).toBeDefined();
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);

      // Check slot structure
      const slot = slots[0];
      expect(slot).toHaveProperty('start');
      expect(slot).toHaveProperty('end');
      expect(slot).toHaveProperty('isBooked');
      expect(slot).toHaveProperty('booking');
    });

    test('should generate correct number of slots for 8-hour day with 30-min slots', async () => {
      const from = DateTime.now().plus({ days: 1 }).toISODate();
      const to = DateTime.now().plus({ days: 1 }).toISODate();

      const slots = await generateSlotsForRange(testProvider, from, to);

      // 09:00-17:00 = 8 hours = 480 minutes / 30 minutes = 16 slots
      expect(slots.length).toBe(16);
    });

    test('should respect weekday restrictions', async () => {
      // Create provider that only works on Mondays (weekday = 1)
      const mondayOnlyProvider = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          recurringRules: [{
            daysOfWeek: [1], // Monday only
            startTime: '09:00',
            endTime: '17:00',
            slotDuration: 30
          }]
        }
      });

      // Find next Monday
      let nextMonday = DateTime.now().plus({ days: 1 });
      while (nextMonday.weekday !== 1) {
        nextMonday = nextMonday.plus({ days: 1 });
      }

      // Find next Tuesday  
      const nextTuesday = nextMonday.plus({ days: 1 });

      // Monday should have slots
      const mondaySlots = await generateSlotsForRange(
        mondayOnlyProvider,
        nextMonday.toISODate(),
        nextMonday.toISODate()
      );
      expect(mondaySlots.length).toBeGreaterThan(0);

      // Tuesday should have no slots
      const tuesdaySlots = await generateSlotsForRange(
        mondayOnlyProvider,
        nextTuesday.toISODate(),
        nextTuesday.toISODate()
      );
      expect(tuesdaySlots.length).toBe(0);
    });
  });

  describe('Booking conflicts', () => {
    test('should mark overlapping slots as booked', async () => {
      // Create a booking for tomorrow 10:00-10:30
      const tomorrow = DateTime.now().plus({ days: 1 });
      const bookingStart = tomorrow.set({ hour: 10, minute: 0 });
      const bookingEnd = bookingStart.plus({ minutes: 30 });

      await createTestBooking(testProvider, testPatient, {
        start: bookingStart.toJSDate(),
        end: bookingEnd.toJSDate()
      });

      const slots = await generateSlotsForRange(testProvider, tomorrow.toISODate(), tomorrow.toISODate());

      // Find the 10:00-10:30 slot
      const bookedSlot = slots.find(slot => {
        const slotStart = DateTime.fromISO(slot.start);
        return slotStart.hour === 10 && slotStart.minute === 0;
      });

      expect(bookedSlot).toBeDefined();
      expect(bookedSlot.isBooked).toBe(true);
      expect(bookedSlot.booking).toBeTruthy();
    });

    test('should not mark non-overlapping slots as booked', async () => {
      // Create a booking for tomorrow 14:00-14:30
      const tomorrow = DateTime.now().plus({ days: 1 });
      const bookingStart = tomorrow.set({ hour: 14, minute: 0 });
      const bookingEnd = bookingStart.plus({ minutes: 30 });

      await createTestBooking(testProvider, testPatient, {
        start: bookingStart.toJSDate(),
        end: bookingEnd.toJSDate()
      });

      const slots = await generateSlotsForRange(testProvider, tomorrow.toISODate(), tomorrow.toISODate());

      // Find the 10:00-10:30 slot (should not be booked)
      const availableSlot = slots.find(slot => {
        const slotStart = DateTime.fromISO(slot.start);
        return slotStart.hour === 10 && slotStart.minute === 0;
      });

      expect(availableSlot).toBeDefined();
      expect(availableSlot.isBooked).toBe(false);
      expect(availableSlot.booking).toBeNull();
    });
  });

  describe('Schedule exceptions', () => {
    test('should skip blackout days', async () => {
      const tomorrow = DateTime.now().plus({ days: 1 });
      const blackoutProvider = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          exceptions: [{
            date: tomorrow.toISODate(),
            available: false,
            note: 'Holiday'
          }]
        }
      });

      const slots = await generateSlotsForRange(
        blackoutProvider,
        tomorrow.toISODate(),
        tomorrow.toISODate()
      );

      expect(slots.length).toBe(0);
    });

    test('should add special availability exceptions', async () => {
      const tomorrow = DateTime.now().plus({ days: 1 });
      
      // Create provider with no regular schedule on weekends
      const weekdayProvider = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          recurringRules: [{
            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri only
            startTime: '09:00',
            endTime: '17:00',
            slotDuration: 30
          }],
          exceptions: [{
            date: tomorrow.toISODate(),
            available: true,
            startTime: '10:00',
            endTime: '12:00',
            note: 'Special Saturday hours'
          }]
        }
      });

      const slots = await generateSlotsForRange(
        weekdayProvider,
        tomorrow.toISODate(),
        tomorrow.toISODate()
      );

      // Should have 4 slots (10:00-12:00 with 30-min duration)
      const exceptionSlots = slots.filter(slot => slot.isException);
      expect(exceptionSlots.length).toBe(4);
    });
  });

  describe('Notice period and booking horizon', () => {
    test('should exclude slots within notice period', async () => {
      const providerWith2HourNotice = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          minNoticeMinutes: 120 // 2 hours
        }
      });

      const today = DateTime.now().toISODate();
      const slots = await generateSlotsForRange(
        providerWith2HourNotice,
        today,
        today
      );

      // All slots should be at least 2 hours in the future
      const now = DateTime.now();
      slots.forEach(slot => {
        const slotStart = DateTime.fromISO(slot.start);
        const diffMinutes = slotStart.diff(now, 'minutes').minutes;
        expect(diffMinutes).toBeGreaterThanOrEqual(120);
      });
    });

    test('should exclude slots beyond booking horizon', async () => {
      const providerWith1DayHorizon = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          maxDaysAhead: 1
        }
      });

      const twoDaysOut = DateTime.now().plus({ days: 2 }).toISODate();
      const slots = await generateSlotsForRange(
        providerWith1DayHorizon,
        twoDaysOut,
        twoDaysOut
      );

      expect(slots.length).toBe(0);
    });
  });

  describe('Timezone handling', () => {
    test('should handle different timezones correctly', async () => {
      const nyCProvider = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          timezone: 'America/New_York'
        }
      });

      const tomorrow = DateTime.now().plus({ days: 1 }).toISODate();
      const slots = await generateSlotsForRange(nyCProvider, tomorrow, tomorrow);

      expect(slots.length).toBeGreaterThan(0);
      
      // Verify slots have timezone information
      const slot = slots[0];
      expect(slot.providerTimezone).toBe('America/New_York');
      expect(slot.localStart).toBeDefined();
      expect(slot.localEnd).toBeDefined();
    });
  });

  describe('Duplicate slot removal', () => {
    test('should remove duplicate slots from overlapping rules and exceptions', async () => {
      const tomorrow = DateTime.now().plus({ days: 1 });
      const providerWithOverlap = await createTestProvider({
        scheduleConfig: {
          ...testProvider.scheduleConfig,
          recurringRules: [{
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
            startTime: '10:00',
            endTime: '12:00',
            slotDuration: 30
          }],
          exceptions: [{
            date: tomorrow.toISODate(),
            available: true,
            startTime: '10:00',
            endTime: '12:00',
            note: 'Duplicate exception'
          }]
        }
      });

      const slots = await generateSlotsForRange(
        providerWithOverlap,
        tomorrow.toISODate(),
        tomorrow.toISODate()
      );

      // Should have exactly 4 slots (10:00-12:00 with 30-min slots), no duplicates
      expect(slots.length).toBe(4);

      // Verify no duplicate start times
      const startTimes = slots.map(slot => slot.start);
      const uniqueStartTimes = [...new Set(startTimes)];
      expect(startTimes.length).toBe(uniqueStartTimes.length);
    });
  });
});
