/**
 * Simple Express server: providers & bookings endpoints
 * Environment:
 *  MONGODB_URI (default: mongodb://localhost:27017/sandbox_scheduler)
 *  PORT (default: 4000)
 */
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const providersRoute = require('./routes/providers');
const bookingsRoute = require('./routes/bookings');
const scheduleRoutes = require("./routes/schedule");
const patientsRouter = require("./routes/patients");



const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api/providers', providersRoute);
app.use('/api/bookings', bookingsRoute);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/patients", patientsRouter);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Mongo connect error', err);
    process.exit(1);
  });
