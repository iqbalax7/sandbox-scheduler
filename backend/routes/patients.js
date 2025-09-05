const express = require('express');
const Patient = require('../models/Patient');
const router = express.Router();
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const { validateBody, patientSchema, isValidObjectId } = require('../utils/validation');

// Create a patient
router.post('/', validateBody(patientSchema), asyncHandler(async (req, res) => {
  const patient = await Patient.create(req.body);
  
  res.status(201).json({
    success: true,
    data: patient
  });
}));

// List all patients
router.get('/', asyncHandler(async (req, res) => {
  const { search, limit = 50, skip = 0 } = req.query;
  
  const filter = {};
  if (search) {
    filter.$or = [
      { first_name: { $regex: search, $options: 'i' } },
      { last_name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  const patients = await Patient.find(filter)
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .sort({ last_name: 1, first_name: 1 });
    
  const total = await Patient.countDocuments(filter);
  
  res.json({
    success: true,
    count: patients.length,
    total,
    data: patients
  });
}));

// Get a single patient
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!isValidObjectId(id)) {
    throw createNotFoundError('Patient');
  }
  
  const patient = await Patient.findById(id);
  if (!patient) {
    throw createNotFoundError('Patient');
  }
  
  res.json({
    success: true,
    data: patient
  });
}));

// Update a patient
router.put('/:id', validateBody(patientSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!isValidObjectId(id)) {
    throw createNotFoundError('Patient');
  }
  
  const patient = await Patient.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!patient) {
    throw createNotFoundError('Patient');
  }
  
  res.json({
    success: true,
    data: patient
  });
}));

// Delete a patient
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!isValidObjectId(id)) {
    throw createNotFoundError('Patient');
  }
  
  const patient = await Patient.findByIdAndDelete(id);
  if (!patient) {
    throw createNotFoundError('Patient');
  }
  
  res.json({
    success: true,
    message: 'Patient deleted successfully'
  });
}));

module.exports = router;
