require('dotenv').config();
const mongoose = require('mongoose');

const setupDatabase = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler';
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB for setup');
    
    const db = mongoose.connection.db;
    
    // Create indexes for Provider collection
    console.log('📊 Creating Provider indexes...');
    await db.collection('providers').createIndex({ email: 1 }, { unique: true });
    await db.collection('providers').createIndex({ name: 1 });
    await db.collection('providers').createIndex({ 'scheduleConfig.timezone': 1 });
    await db.collection('providers').createIndex({ createdAt: -1 });
    
    // Create indexes for Patient collection
    console.log('📊 Creating Patient indexes...');
    await db.collection('patients').createIndex({ email: 1 }, { unique: true });
    await db.collection('patients').createIndex({ last_name: 1, first_name: 1 });
    await db.collection('patients').createIndex({ createdAt: -1 });
    
    // Create compound text index for patient search
    await db.collection('patients').createIndex({
      first_name: 'text',
      last_name: 'text',
      email: 'text'
    }, {
      name: 'patient_search_index',
      weights: {
        first_name: 3,
        last_name: 3,
        email: 2
      }
    });
    
    // Create indexes for Booking collection
    console.log('📊 Creating Booking indexes...');
    await db.collection('bookings').createIndex({ provider: 1, start: 1 });
    await db.collection('bookings').createIndex({ patient: 1, start: 1 });
    await db.collection('bookings').createIndex({ status: 1 });
    await db.collection('bookings').createIndex({ start: 1, end: 1 });
    await db.collection('bookings').createIndex({ createdAt: -1 });
    
    // Compound index for booking overlap detection
    await db.collection('bookings').createIndex({
      provider: 1,
      status: 1,
      start: 1,
      end: 1
    }, {
      name: 'booking_overlap_check'
    });
    
    // Index for time range queries
    await db.collection('bookings').createIndex({
      provider: 1,
      start: 1,
      status: 1
    }, {
      name: 'provider_schedule_lookup'
    });
    
    console.log('✅ All database indexes created successfully');
    
    // List all indexes for verification
    console.log('\\n📋 Index Summary:');
    const collections = ['providers', 'patients', 'bookings'];
    
    for (const collectionName of collections) {
      const indexes = await db.collection(collectionName).listIndexes().toArray();
      console.log(`\\n${collectionName}:`);
      indexes.forEach(index => {
        console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database setup error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\\n🔌 Database connection closed');
  }
};

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
