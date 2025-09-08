require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');
const Patient = require('./models/Patient');
const Booking = require('./models/Booking');

/**
 * Cross-Timezone Scheduling Demo Seeder
 * 
 * Demonstrates scheduling between:
 * - Provider in Hawaii (UTC-10, Pacific/Honolulu)
 * - Patient in Pakistan (UTC+5, Asia/Karachi)
 * 
 * Time difference: 15 hours (Pakistan is 15 hours ahead of Hawaii)
 * When it's 9:00 AM in Hawaii, it's 12:00 AM (midnight) the next day in Pakistan
 */

// Helper function to format dates for examples
const formatDate = (date) => date.toISOString().split('T')[0];
const addDays = (date, days) => new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
const today = new Date();

const HAWAII_PROVIDER = {
  name: 'Dr. Aloha Wellness',
  email: 'dr.wellness@hawaii.telemedicine',
  scheduleConfig: {
    timezone: 'Pacific/Honolulu', // Hawaii Standard Time (HST) - UTC-10
    minNoticeMinutes: 120, // 2 hours notice
    maxDaysAhead: 30,
    recurringRules: [
      {
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        startTime: '08:00', // 8:00 AM HST (6:00 PM PST same day)
        endTime: '12:00',   // 12:00 PM HST (10:00 PM PST same day)
        slotDuration: 30    // 30-minute appointments
      },
      {
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        startTime: '13:00', // 1:00 PM HST (11:00 PM PST same day)
        endTime: '17:00',   // 5:00 PM HST (3:00 AM PST next day)
        slotDuration: 30
      },
      {
        daysOfWeek: [6], // Saturday
        startTime: '09:00', // 9:00 AM HST (7:00 PM PST same day)
        endTime: '13:00',   // 1:00 PM HST (11:00 PM PST same day)
        slotDuration: 45    // Longer Saturday slots
      }
    ],
    exceptions: [
      {
        date: formatDate(addDays(today, 7)),
        available: false,
        note: 'Attending Hawaii Medical Conference'
      },
      {
        date: formatDate(addDays(today, 14)),
        available: true,
        startTime: '18:00', // Extended evening hours
        endTime: '21:00',   // 6:00 PM - 9:00 PM HST (12:00 PM - 3:00 PM PST next day)
        note: 'Special evening hours for international patients'
      }
    ]
  }
};

const KARACHI_PATIENT = {
  first_name: 'Ahmed',
  last_name: 'Hassan',
  email: 'ahmed.hassan@karachi.pk',
  phone: '+92-300-1234567',
  dateOfBirth: new Date('1985-03-15'),
  timezone: 'Asia/Karachi' // Pakistan Standard Time (PST) - UTC+5
};

const DEMO_BOOKINGS = [
  {
    // Booking 1: Morning appointment in Hawaii = Evening in Pakistan
    // Hawaii: 9:00 AM HST -> Pakistan: 12:00 AM PST (next day midnight)
    appointmentNote: 'Hawaii 9:00 AM = Pakistan 12:00 AM next day',
    hawaiiTime: '09:00',
    date: addDays(today, 3)
  },
  {
    // Booking 2: Afternoon appointment in Hawaii = Early morning in Pakistan next day
    // Hawaii: 2:00 PM HST -> Pakistan: 5:00 AM PST (next day)
    appointmentNote: 'Hawaii 2:00 PM = Pakistan 5:00 AM next day',
    hawaiiTime: '14:00',
    date: addDays(today, 10)
  }
];

// Helper function to convert Hawaii time to Pakistan time
function hawaiiToPakistanTime(hawaiiDate) {
  const hawaiiTz = 'Pacific/Honolulu';
  const pakistanTz = 'Asia/Karachi';
  
  // Convert to Pakistan timezone
  const pakistanTime = new Date(hawaiiDate.toLocaleString('en-US', { 
    timeZone: pakistanTz 
  }));
  
  return {
    hawaiiTime: hawaiiDate.toLocaleString('en-US', { 
      timeZone: hawaiiTz, 
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }),
    pakistanTime: hawaiiDate.toLocaleString('en-US', { 
      timeZone: pakistanTz,
      weekday: 'long', 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  };
}

const seedTimezoneDemo = async () => {
  try {
    console.log('🌺 Starting Cross-Timezone Scheduling Demo Seeder');
    console.log('   Provider: Hawaii (Pacific/Honolulu - UTC-10)');
    console.log('   Patient: Pakistan (Asia/Karachi - UTC+5)');
    console.log('   Time Difference: 15 hours (Pakistan ahead)\n');

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Provider.deleteMany({ email: HAWAII_PROVIDER.email });
    await Patient.deleteMany({ email: KARACHI_PATIENT.email });
    await Booking.deleteMany({}); // Clear all bookings for clean demo
    console.log('   ✓ Cleared existing providers, patients, and bookings\n');

    // Create Hawaii Provider
    console.log('🏥 Creating Hawaii Provider...');
    const provider = await Provider.create(HAWAII_PROVIDER);
    console.log(`   ✓ Created: ${provider.name}`);
    console.log(`   ✓ Email: ${provider.email}`);
    console.log(`   ✓ Timezone: ${provider.scheduleConfig.timezone}`);
    console.log(`   ✓ Working Hours: Mon-Fri 8AM-12PM & 1PM-5PM HST, Sat 9AM-1PM HST\n`);

    // Create Pakistan Patient
    console.log('🏥 Creating Pakistan Patient...');
    const patient = await Patient.create(KARACHI_PATIENT);
    console.log(`   ✓ Created: ${patient.fullName}`);
    console.log(`   ✓ Email: ${patient.email}`);
    console.log(`   ✓ Phone: ${patient.phone}`);
    console.log(`   ✓ Timezone: ${patient.timezone}\n`);

    // Create sample bookings to demonstrate timezone conversion
    console.log('📅 Creating Sample Bookings (Timezone Conversion Examples)...');
    
    for (let i = 0; i < DEMO_BOOKINGS.length; i++) {
      const bookingData = DEMO_BOOKINGS[i];
      
      // Create appointment date in Hawaii timezone
      const [hours, minutes] = bookingData.hawaiiTime.split(':').map(Number);
      const appointmentDate = new Date(bookingData.date);
      appointmentDate.setHours(hours, minutes, 0, 0);
      
      // Convert to UTC for storage (the booking model expects UTC)
      const hawaiiOffset = -10 * 60; // Hawaii is UTC-10
      const utcDate = new Date(appointmentDate.getTime() - (hawaiiOffset * 60 * 1000));
      const endDate = new Date(utcDate.getTime() + (30 * 60 * 1000)); // 30-minute slot
      
      const booking = await Booking.create({
        provider: provider._id,
        patient: patient._id,
        start: utcDate,
        end: endDate,
        notes: `${bookingData.appointmentNote} - Telemedicine consultation`,
        status: 'booked'
      });

      // Show timezone conversion
      const timeConversion = hawaiiToPakistanTime(utcDate);
      
      console.log(`   📋 Booking ${i + 1}:`);
      console.log(`      🌺 Hawaii Time: ${timeConversion.hawaiiTime}`);
      console.log(`      🇵🇰 Pakistan Time: ${timeConversion.pakistanTime}`);
      console.log(`      📝 Note: ${bookingData.appointmentNote}`);
      console.log(`      ⏱️  Duration: 30 minutes\n`);
    }

    // Show timezone analysis
    console.log('🌍 Timezone Analysis:');
    console.log('   • When it\'s business hours in Hawaii (8 AM - 5 PM HST):');
    console.log('     - 8:00 AM HST = 11:00 PM PST (same day in Pakistan)');
    console.log('     - 12:00 PM HST = 3:00 AM PST (next day in Pakistan)');
    console.log('     - 5:00 PM HST = 8:00 AM PST (next day in Pakistan)');
    console.log('\n   • Best appointment times for both parties:');
    console.log('     - Hawaii 4:00-5:00 PM HST = Pakistan 7:00-8:00 AM PST (next day)');
    console.log('     - Hawaii 6:00-9:00 PM HST = Pakistan 9:00 AM-12:00 PM PST (next day)');

    console.log('\n   • Challenges:');
    console.log('     - Hawaii morning hours = Pakistan midnight-dawn (not ideal for patient)');
    console.log('     - Hawaii evening hours = Pakistan morning (better for patient)');
    console.log('     - Weekend scheduling might work better due to flexibility\n');

    // Show provider schedule in both timezones
    console.log('📊 Provider Schedule (showing both timezones):');
    console.log('   Monday-Friday:');
    console.log('   ├─ 8:00 AM - 12:00 PM HST → 11:00 PM - 3:00 AM PST (next day)');
    console.log('   └─ 1:00 PM - 5:00 PM HST → 4:00 AM - 8:00 AM PST (next day)');
    console.log('   Saturday:');
    console.log('   └─ 9:00 AM - 1:00 PM HST → 12:00 AM - 4:00 AM PST (next day)');

    console.log('\n🎉 Cross-timezone seeding completed successfully!');
    console.log(`   ✅ Created 1 Hawaii provider (${provider.name})`);
    console.log(`   ✅ Created 1 Pakistan patient (${patient.fullName})`);
    console.log(`   ✅ Created ${DEMO_BOOKINGS.length} sample bookings demonstrating timezone conversion`);

    console.log('\n💡 Next Steps:');
    console.log('   • Test the frontend calendar with these appointments');
    console.log('   • Verify appointment times display correctly in both timezones');
    console.log('   • Check that booking validation respects timezone differences');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    if (error.name === 'ValidationError') {
      console.error('   Validation errors:', Object.keys(error.errors).map(key => 
        `${key}: ${error.errors[key].message}`
      ));
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  seedTimezoneDemo();
}

module.exports = { 
  seedTimezoneDemo, 
  HAWAII_PROVIDER, 
  KARACHI_PATIENT, 
  hawaiiToPakistanTime 
};
