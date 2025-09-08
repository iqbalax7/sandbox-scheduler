const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');

// Import app components
const providersRoute = require('../../routes/providers');
const bookingsRoute = require('../../routes/bookings');
const scheduleRoutes = require('../../routes/schedule');
const patientsRouter = require('../../routes/patients');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Add routes
  app.use('/api/providers', providersRoute);
  app.use('/api/bookings', bookingsRoute);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/patients', patientsRouter);
  
  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
};

describe('API Integration Tests', () => {
  let app;
  let testProvider;
  let testPatient;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    testProvider = await createTestProvider();
    testPatient = await createTestPatient();
  });

  describe('Provider Endpoints', () => {
    describe('GET /api/providers', () => {
      test('should return list of providers', async () => {
        const response = await request(app)
          .get('/api/providers')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.count).toBeGreaterThan(0);
      });
    });

    describe('POST /api/providers', () => {
      test('should create a new provider', async () => {
        const newProvider = {
          name: 'Dr. New Provider',
          email: 'new@example.com'
        };

        const response = await request(app)
          .post('/api/providers')
          .send(newProvider)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(newProvider.name);
        expect(response.body.data.email).toBe(newProvider.email);
      });

      test('should reject invalid provider data', async () => {
        const invalidProvider = {
          name: '', // Empty name
          email: 'invalid-email' // Invalid email
        };

        const response = await request(app)
          .post('/api/providers')
          .send(invalidProvider)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('validation');
      });

      test('should reject duplicate email', async () => {
        const duplicateProvider = {
          name: 'Dr. Duplicate',
          email: testProvider.email // Same email as existing provider
        };

        const response = await request(app)
          .post('/api/providers')
          .send(duplicateProvider)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('already exists');
      });
    });

    describe('PUT /api/providers/:id/config', () => {
      test('should update provider schedule config', async () => {
        const newConfig = {
          timezone: 'America/New_York',
          minNoticeMinutes: 120,
          maxDaysAhead: 60,
          recurringRules: [{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '18:00',
            slotDuration: 60
          }]
        };

        const response = await request(app)
          .put(`/api/providers/${testProvider._id}/config`)
          .send(newConfig)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.scheduleConfig.timezone).toBe(newConfig.timezone);
        expect(response.body.data.scheduleConfig.minNoticeMinutes).toBe(newConfig.minNoticeMinutes);
      });

      test('should reject invalid provider ID', async () => {
        const response = await request(app)
          .put('/api/providers/invalid-id/config')
          .send({})
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/providers/:id/availability', () => {
      test('should return provider availability slots', async () => {
        const from = DateTime.now().plus({ days: 1 }).toISO();
        const to = DateTime.now().plus({ days: 2 }).toISO();

        const response = await request(app)
          .get(`/api/providers/${testProvider._id}/availability`)
          .query({ from, to })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.provider).toBeDefined();
        expect(response.body.data.slots).toBeInstanceOf(Array);
        expect(response.body.data.totalSlots).toBeGreaterThan(0);
      });

      test('should require from and to parameters', async () => {
        const response = await request(app)
          .get(`/api/providers/${testProvider._id}/availability`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('required');
      });
    });
  });

  describe('Patient Endpoints', () => {
    describe('GET /api/patients', () => {
      test('should return list of patients', async () => {
        const response = await request(app)
          .get('/api/patients')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.count).toBeGreaterThan(0);
      });

      test('should support search functionality', async () => {
        const response = await request(app)
          .get('/api/patients')
          .query({ search: 'John' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('POST /api/patients', () => {
      test('should create a new patient', async () => {
        const newPatient = {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com'
        };

        const response = await request(app)
          .post('/api/patients')
          .send(newPatient)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.first_name).toBe(newPatient.first_name);
        expect(response.body.data.email).toBe(newPatient.email);
      });

      test('should reject invalid patient data', async () => {
        const invalidPatient = {
          first_name: '', // Empty first name
          last_name: 'Smith',
          email: 'invalid-email'
        };

        const response = await request(app)
          .post('/api/patients')
          .send(invalidPatient)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/patients/:id', () => {
      test('should return specific patient', async () => {
        const response = await request(app)
          .get(`/api/patients/${testPatient._id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data._id).toBe(testPatient._id.toString());
      });

      test('should return 404 for non-existent patient', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        
        const response = await request(app)
          .get(`/api/patients/${fakeId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Booking Endpoints', () => {
    describe('POST /api/bookings', () => {
      test('should create a new booking', async () => {
        const tomorrow = DateTime.now().plus({ days: 1 });
        const start = tomorrow.set({ hour: 10, minute: 0 });
        const end = start.plus({ minutes: 30 });

        const bookingData = {
          providerId: testProvider._id.toString(),
          patientId: testPatient._id.toString(),
          start: start.toISO(),
          end: end.toISO()
        };

        const response = await request(app)
          .post('/api/bookings')
          .send(bookingData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('booked');
        expect(response.body.data.provider).toBeDefined();
        expect(response.body.data.patient).toBeDefined();
      });

      test('should reject booking with invalid data', async () => {
        const invalidBooking = {
          providerId: 'invalid-id',
          patientId: testPatient._id.toString(),
          start: 'invalid-date',
          end: 'invalid-date'
        };

        const response = await request(app)
          .post('/api/bookings')
          .send(invalidBooking)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      test('should reject overlapping bookings', async () => {
        const tomorrow = DateTime.now().plus({ days: 1 });
        const start = tomorrow.set({ hour: 10, minute: 0 });
        const end = start.plus({ minutes: 30 });

        // Create first booking
        await createTestBooking(testProvider, testPatient, {
          start: start.toJSDate(),
          end: end.toJSDate()
        });

        // Try to create overlapping booking
        const overlappingBooking = {
          providerId: testProvider._id.toString(),
          patientId: testPatient._id.toString(),
          start: start.toISO(),
          end: end.toISO()
        };

        const response = await request(app)
          .post('/api/bookings')
          .send(overlappingBooking)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('already booked');
      });

      test('should reject booking too soon (notice period)', async () => {
        const providerWith4HourNotice = await createTestProvider({
          scheduleConfig: {
            ...testProvider.scheduleConfig,
            minNoticeMinutes: 240 // 4 hours
          }
        });

        const soon = DateTime.now().plus({ minutes: 30 }); // Only 30 minutes notice
        const bookingData = {
          providerId: providerWith4HourNotice._id.toString(),
          patientId: testPatient._id.toString(),
          start: soon.toISO(),
          end: soon.plus({ minutes: 30 }).toISO()
        };

        const response = await request(app)
          .post('/api/bookings')
          .send(bookingData)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('notice');
      });
    });

    describe('GET /api/bookings', () => {
      test('should return list of bookings', async () => {
        await createTestBooking(testProvider, testPatient);

        const response = await request(app)
          .get('/api/bookings')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.count).toBeGreaterThan(0);
      });

      test('should filter bookings by provider', async () => {
        const booking = await createTestBooking(testProvider, testPatient);

        const response = await request(app)
          .get('/api/bookings')
          .query({ providerId: testProvider._id.toString() })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0]._id).toBe(booking._id.toString());
      });

      test('should filter bookings by date range', async () => {
        const today = DateTime.now();
        const tomorrow = today.plus({ days: 1 });
        
        await createTestBooking(testProvider, testPatient, {
          start: tomorrow.set({ hour: 10 }).toJSDate(),
          end: tomorrow.set({ hour: 10, minute: 30 }).toJSDate()
        });

        const response = await request(app)
          .get('/api/bookings')
          .query({
            startDate: tomorrow.toISODate(),
            endDate: tomorrow.toISODate()
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.count).toBeGreaterThan(0);
      });
    });

    describe('PATCH /api/bookings/:id/cancel', () => {
      test('should cancel a booking', async () => {
        const booking = await createTestBooking(testProvider, testPatient);

        const response = await request(app)
          .patch(`/api/bookings/${booking._id}/cancel`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('cancelled');
        expect(response.body.data.cancelledAt).toBeDefined();
      });

      test('should reject cancelling already cancelled booking', async () => {
        const booking = await createTestBooking(testProvider, testPatient, {
          status: 'cancelled',
          cancelledAt: new Date()
        });

        const response = await request(app)
          .patch(`/api/bookings/${booking._id}/cancel`)
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('already cancelled');
      });
    });
  });

  describe('Schedule Endpoints', () => {
    describe('GET /api/schedule/available', () => {
      test('should return available slots for provider', async () => {
        const tomorrow = DateTime.now().plus({ days: 1 });
        
        const response = await request(app)
          .get('/api/schedule/available')
          .query({
            providerId: testProvider._id.toString(),
            startDate: tomorrow.toISODate(),
            endDate: tomorrow.toISODate()
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.provider).toBeDefined();
        expect(response.body.data.slots).toBeInstanceOf(Array);
        expect(response.body.data.summary).toBeDefined();
      });

      test('should require all query parameters', async () => {
        const response = await request(app)
          .get('/api/schedule/available')
          .query({ providerId: testProvider._id.toString() })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('required');
      });

      test('should handle invalid provider ID', async () => {
        const tomorrow = DateTime.now().plus({ days: 1 });
        
        const response = await request(app)
          .get('/api/schedule/available')
          .query({
            providerId: 'invalid-id',
            startDate: tomorrow.toISODate(),
            endDate: tomorrow.toISODate()
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      test('should handle provider with no schedule config', async () => {
        const providerNoSchedule = await createTestProvider({
          scheduleConfig: {
            recurringRules: []
          }
        });

        const tomorrow = DateTime.now().plus({ days: 1 });
        
        const response = await request(app)
          .get('/api/schedule/available')
          .query({
            providerId: providerNoSchedule._id.toString(),
            startDate: tomorrow.toISODate(),
            endDate: tomorrow.toISODate()
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.slots).toHaveLength(0);
        expect(response.body.data.message).toContain('No schedule configuration');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/providers')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should include request ID in error responses', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.headers['x-request-id']).toBeDefined();
    });
  });
});
