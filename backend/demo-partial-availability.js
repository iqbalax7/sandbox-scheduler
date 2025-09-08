require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

/**
 * Demonstration: Handling Partial Availability with Exceptions
 * 
 * Scenario: Hawaii provider normally works 9AM-5PM Mon-Fri
 * Exception: Wednesday Sept 10, 2025 - only available 12PM-4PM
 */

const demonstratePartialAvailability = async () => {
  try {
    console.log('🎯 Demonstrating Partial Availability Handling\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create a provider with normal schedule + partial availability exception
    const providerData = {
      name: 'Dr. Hawaii Flexible',
      email: 'flexible@hawaii.example',
      scheduleConfig: {
        timezone: 'Pacific/Honolulu',
        minNoticeMinutes: 60,
        maxDaysAhead: 30,
        
        // Regular recurring schedule
        recurringRules: [
          {
            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
            startTime: '09:00',           // 9 AM
            endTime: '17:00',             // 5 PM
            slotDuration: 30
          }
        ],
        
        // Exceptions for specific dates
        exceptions: [
          // COMPLETE UNAVAILABILITY
          {
            date: '2025-09-08',
            available: false,
            note: 'Attending Medical Conference (Full Day)'
          },
          
          // PARTIAL AVAILABILITY - Your exact scenario
          {
            date: '2025-09-10', // Wednesday
            available: true,     // Still available
            startTime: '12:00',  // But only 12 PM...
            endTime: '16:00',    // ...to 4 PM
            note: 'Reduced hours - Morning conference, early departure'
          },
          
          // EXTENDED AVAILABILITY
          {
            date: '2025-09-12', // Friday
            available: true,
            startTime: '08:00',  // Earlier start
            endTime: '19:00',    // Later end
            note: 'Extended hours to accommodate more patients'
          },
          
          // SPLIT AVAILABILITY (Multiple sessions)
          {
            date: '2025-09-15', // Monday
            available: true,
            startTime: '10:00',  // Note: This represents first available period
            endTime: '12:00',    // The system would need logic to handle splits
            note: '10AM-12PM and 3PM-5PM only (lunch meeting 12-3PM)'
          }
        ]
      }
    };

    // Clear and create the demo provider
    await Provider.deleteMany({ email: providerData.email });
    const provider = await Provider.create(providerData);

    console.log(`✅ Created Provider: ${provider.name}`);
    console.log(`📧 Email: ${provider.email}`);
    console.log(`🌺 Timezone: ${provider.scheduleConfig.timezone}`);
    console.log(`📅 Regular Schedule: Mon-Fri 9AM-5PM HST\n`);

    console.log('🔄 Schedule Exceptions:');
    provider.scheduleConfig.exceptions.forEach((exception, index) => {
      const date = new Date(exception.date + 'T00:00:00');
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      console.log(`   ${index + 1}. ${dayName}, ${exception.date}:`);
      
      if (!exception.available) {
        console.log(`      ❌ COMPLETELY UNAVAILABLE`);
      } else {
        if (exception.startTime && exception.endTime) {
          console.log(`      ⏰ PARTIAL AVAILABILITY: ${exception.startTime} - ${exception.endTime} HST`);
        } else {
          console.log(`      ✅ AVAILABLE (regular hours apply)`);
        }
      }
      
      if (exception.note) {
        console.log(`      📝 Note: ${exception.note}`);
      }
      console.log('');
    });

    // Show how the slot generation logic should work
    console.log('🧮 How Slot Generation Should Handle This:\n');
    
    console.log('   Normal Wednesday (any other Wednesday):');
    console.log('   ├─ 9:00 AM - Available');
    console.log('   ├─ 9:30 AM - Available');
    console.log('   ├─ ... (all slots 9AM-5PM)');
    console.log('   └─ 4:30 PM - Available\n');
    
    console.log('   Exception Wednesday (Sept 10, 2025):');
    console.log('   ├─ 9:00 AM - ❌ NOT AVAILABLE (before exception start)');
    console.log('   ├─ 9:30 AM - ❌ NOT AVAILABLE');
    console.log('   ├─ 11:30 AM - ❌ NOT AVAILABLE');
    console.log('   ├─ 12:00 PM - ✅ AVAILABLE (exception start)');
    console.log('   ├─ 12:30 PM - ✅ AVAILABLE');
    console.log('   ├─ ... (slots until 4PM)');
    console.log('   ├─ 3:30 PM - ✅ AVAILABLE (last slot before exception end)');
    console.log('   ├─ 4:00 PM - ❌ NOT AVAILABLE (after exception end)');
    console.log('   └─ 4:30 PM - ❌ NOT AVAILABLE\n');

    // Show the algorithm logic
    console.log('⚙️  Slot Generation Algorithm:');
    console.log('   1. Start with recurring rules for the day');
    console.log('   2. Check if there\'s an exception for this specific date');
    console.log('   3. If exception exists:');
    console.log('      - If available=false → No slots for this day');
    console.log('      - If available=true + custom times → Use exception times');
    console.log('      - If available=true + no custom times → Use regular times');
    console.log('   4. Generate slots within the determined time range');
    console.log('   5. Filter out any existing bookings\n');

    console.log('💾 Database Storage:');
    console.log('   • Exceptions are stored in provider.scheduleConfig.exceptions[]');
    console.log('   • Times are stored in provider timezone (Hawaii time)');
    console.log('   • Slot generation happens in real-time during API calls');
    console.log('   • Frontend receives slots already filtered by exceptions\n');

    console.log('🌍 Cross-Timezone Impact:');
    console.log('   Hawaii 12PM-4PM = Pakistan 3AM-7AM next day');
    console.log('   → Pakistani patient would see very early morning slots');
    console.log('   → System should show timezone-aware warnings to patients\n');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// For complex scenarios like split availability, you might need multiple exceptions:
const handleSplitAvailability = () => {
  console.log('🔀 Handling Complex Split Availability:');
  console.log('   Scenario: Available 10AM-12PM and 3PM-5PM only\n');
  
  console.log('   Option 1: Multiple exceptions for same date (if supported):');
  console.log('   • Exception 1: date="2025-09-15", startTime="10:00", endTime="12:00"');
  console.log('   • Exception 2: date="2025-09-15", startTime="15:00", endTime="17:00"\n');
  
  console.log('   Option 2: Use recurring rules + unavailability exception:');
  console.log('   • Create multiple recurring rules for different time blocks');
  console.log('   • Use exception to block lunch period: startTime="12:00", endTime="15:00", available=false\n');
  
  console.log('   Current limitation: Single exception per date');
  console.log('   → May need schema enhancement for complex split schedules\n');
};

if (require.main === module) {
  demonstratePartialAvailability().then(() => {
    handleSplitAvailability();
  });
}

module.exports = { demonstratePartialAvailability };
