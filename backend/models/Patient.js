const mongoose = require('mongoose');
const { Schema } = mongoose;

const PatientSchema = new Schema({
  first_name: String,
  last_name: String,
  email: String
}, { timestamps: true });

module.exports = mongoose.model('Patient', PatientSchema);
