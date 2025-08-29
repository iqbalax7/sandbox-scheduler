const express = require('express');
const router = express.Router();
const Provider = require('../models/Provider');
const generateSlots = require('../lib/generateSlotsForRange');


// list providers
router.get('/', async (req, res) => {
  const all = await Provider.find().lean();
  res.json(all);
});

// Create a provider (simple)
router.post('/', async (req, res) => {
  const { name, email, scheduleConfig } = req.body;
  const p = await Provider.create({ name, email, scheduleConfig });
  res.json(p);
});

// Update schedule config (replace)
router.put('/:id/config', async (req, res) => {
  const id = req.params.id;
  const config = req.body;
  const p = await Provider.findByIdAndUpdate(id, { scheduleConfig: config }, { new: true });
  if (!p) return res.status(404).send('provider not found');
  res.json(p);
});

// Get availability (generate slots in memory + attach bookings)
router.get('/:id/availability', async (req, res) => {
  const id = req.params.id;
  const from = req.query.from; // ISO UTC
  const to = req.query.to;     // ISO UTC
  if (!from || !to) return res.status(400).send('from & to required (ISO UTC)');
  const provider = await Provider.findById(id);
  if (!provider) return res.status(404).send('provider not found');
  const slots = await generateSlots(provider, from, to);
  res.json({ provider: { _id: provider._id, name: provider.name }, slots });
});

module.exports = router;
