const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  
  // Stop in-memory MongoDB instance
  await mongoServer.stop();
});

// Global test helpers
global.createTestProvider = async (overrides = {}) => {
  const Provider = require('../models/Provider');
  
  const defaultProvider = {
    name: 'Dr. Test Provider',
    email: 'test@example.com',
    scheduleConfig: {
      timezone: 'UTC',
      minNoticeMinutes: 60,
      maxDaysAhead: 30,
      recurringRules: [{
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30
      }],
      exceptions: []
    }
  };
  
  return await Provider.create({ ...defaultProvider, ...overrides });
};

global.createTestPatient = async (overrides = {}) => {
  const Patient = require('../models/Patient');
  
  const defaultPatient = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com'
  };
  
  return await Patient.create({ ...defaultPatient, ...overrides });
};

global.createTestBooking = async (provider, patient, overrides = {}) => {
  const Booking = require('../models/Booking');
  const { DateTime } = require('luxon');
  
  const tomorrow = DateTime.now().plus({ days: 1 });
  const start = tomorrow.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  const end = start.plus({ minutes: 30 });
  
  const defaultBooking = {
    provider: provider._id,
    patient: patient._id,
    start: start.toJSDate(),
    end: end.toJSDate(),
    status: 'booked'
  };
  
  return await Booking.create({ ...defaultBooking, ...overrides });
};

// Suppress console logs during tests unless specifically needed
if (process.env.TEST_VERBOSE !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
}
