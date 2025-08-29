const mongoose = require('mongoose');
const Patient = require('./models/Patient');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const patient = await Patient.create({
      first_name: "Test",
      last_name: "Patient",
      email: "test.patient@example.com"
    });

    console.log("Patient created:", patient);
    process.exit(0);
  } catch (err) {
    console.error("Error seeding patient:", err);
    process.exit(1);
  }
})();
