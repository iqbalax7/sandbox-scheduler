require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');
const Booking = require('./models/Booking');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear collections
    await Provider.deleteMany({});
    await Booking.deleteMany({});

    console.log('Cleared Providers and Bookings');

    // Insert a test provider
    const provider = await Provider.create({
      name: 'Dr. Test',
      email: 'dr.test@example.com',
      scheduleConfig: {
        timezone: 'UTC',
        minNoticeMinutes: 30,
        maxDaysAhead: 14,
        recurringRules: [
          {
            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
            startTime: '09:00',
            endTime: '12:00',
            slotDuration: 30,
          },
          {
            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
            startTime: '13:00',
            endTime: '17:00',
            slotDuration: 30,
          },
        ],
        exceptions: [
          {
            date: '2025-09-01',
            available: false,
            note: 'Labor Day (closed)',
          },
        ],
      },
    });

    console.log(`Seeded Provider: ${provider._id}`);

    console.log('Seeder finished 🚀');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
