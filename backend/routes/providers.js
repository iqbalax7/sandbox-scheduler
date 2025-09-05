const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider');
const generateSlots = require('../lib/generateSlotsForRange');
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const { validateBody, providerSchema, scheduleConfigSchema, isValidObjectId } = require('../utils/validation');

// List all providers
router.get('/', asyncHandler(async (req, res) => {
  const providers = await Provider.find().lean();
  res.json({
    success: true,
    count: providers.length,
    data: providers
  });
}));

// Create a new provider
router.post('/', validateBody(providerSchema), asyncHandler(async (req, res) => {
  const { name, email, scheduleConfig } = req.body;
  
  const provider = await Provider.create({ 
    name, 
    email, 
    scheduleConfig: scheduleConfig || {} 
  });
  
  res.status(201).json({
    success: true,
    data: provider
  });
}));

// Update provider schedule configuration
router.put('/:id/config', validateBody(scheduleConfigSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!isValidObjectId(id)) {
    throw createNotFoundError('Provider');
  }
  
  const provider = await Provider.findByIdAndUpdate(
    id, 
    { scheduleConfig: req.body }, 
    { new: true, runValidators: true }
  );
  
  if (!provider) {
    throw createNotFoundError('Provider');
  }
  
  res.json({
    success: true,
    data: provider
  });
}));

// Get provider availability slots
router.get('/:id/availability', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;
  
  if (!isValidObjectId(id)) {
    throw createNotFoundError('Provider');
  }
  
  if (!from || !to) {
    const error = new Error('Query parameters "from" and "to" are required (ISO UTC format)');
    error.statusCode = 400;
    throw error;
  }
  
  const provider = await Provider.findById(id);
  if (!provider) {
    throw createNotFoundError('Provider');
  }
  
  const slots = await generateSlots(provider, from, to);
  
  res.json({
    success: true,
    data: {
      provider: {
        _id: provider._id,
        name: provider.name
      },
      slots,
      totalSlots: slots.length,
      availableSlots: slots.filter(s => !s.isBooked).length
    }
  });
}));

module.exports = router;
