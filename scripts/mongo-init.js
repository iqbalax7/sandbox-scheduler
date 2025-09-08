// MongoDB initialization script
db = db.getSiblingDB('sandbox_scheduler');

// Create collections with validation
db.createCollection('providers', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 100
        },
        email: {
          bsonType: 'string',
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        },
        scheduleConfig: {
          bsonType: 'object',
          properties: {
            timezone: { bsonType: 'string' },
            minNoticeMinutes: { bsonType: 'number', minimum: 0 },
            maxDaysAhead: { bsonType: 'number', minimum: 1 },
            recurringRules: { bsonType: 'array' },
            exceptions: { bsonType: 'array' }
          }
        },
        isActive: { bsonType: 'bool' }
      }
    }
  }
});

db.createCollection('patients', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['first_name', 'last_name', 'email'],
      properties: {
        first_name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50
        },
        last_name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50
        },
        email: {
          bsonType: 'string',
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        },
        phone: { bsonType: ['string', 'null'] },
        dateOfBirth: { bsonType: ['date', 'null'] },
        isActive: { bsonType: 'bool' }
      }
    }
  }
});

db.createCollection('bookings', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['provider', 'patient', 'start', 'end', 'status'],
      properties: {
        provider: { bsonType: 'objectId' },
        patient: { bsonType: 'objectId' },
        start: { bsonType: 'date' },
        end: { bsonType: 'date' },
        status: {
          bsonType: 'string',
          enum: ['booked', 'cancelled', 'completed', 'no-show']
        },
        notes: { bsonType: ['string', 'null'] },
        cancelledAt: { bsonType: ['date', 'null'] },
        cancellationReason: { bsonType: ['string', 'null'] },
        reminderSent: { bsonType: 'bool' }
      }
    }
  }
});

// Create indexes
print('Creating indexes...');

// Provider indexes
db.providers.createIndex({ email: 1 }, { unique: true });
db.providers.createIndex({ name: 1 });
db.providers.createIndex({ isActive: 1 });
db.providers.createIndex({ 'scheduleConfig.timezone': 1 });

// Patient indexes
db.patients.createIndex({ email: 1 }, { unique: true });
db.patients.createIndex({ last_name: 1, first_name: 1 });
db.patients.createIndex({ isActive: 1 });
db.patients.createIndex({
  first_name: 'text',
  last_name: 'text',
  email: 'text'
}, {
  weights: {
    first_name: 3,
    last_name: 3,
    email: 2
  }
});

// Booking indexes
db.bookings.createIndex({ provider: 1, start: 1 });
db.bookings.createIndex({ patient: 1, start: 1 });
db.bookings.createIndex({ status: 1 });
db.bookings.createIndex({ start: 1, end: 1 });
db.bookings.createIndex({
  provider: 1,
  status: 1,
  start: 1,
  end: 1
}, {
  name: 'booking_overlap_check'
});
db.bookings.createIndex({
  provider: 1,
  start: 1,
  status: 1
}, {
  name: 'provider_schedule_lookup'
});

print('Database initialization complete!');

// Seed a test provider for development
if (db.providers.countDocuments() === 0) {
  print('Seeding test provider...');
  
  db.providers.insertOne({
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
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  print('Test provider created!');
}
