# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

A healthcare appointment scheduling system with a Node.js/Express backend and React frontend. The system manages providers, patients, bookings, and availability scheduling with timezone-aware slot generation.

## Common Development Commands

### Backend Development
```bash
# Start backend server (from backend/ directory)
npm start                    # Production mode
npm run dev                  # Development mode with nodemon

# Database operations
node seed.js                 # Seed database with test provider
node seed-patient.js         # Seed database with test patients

# Install dependencies
npm install
```

### Frontend Development
```bash
# Start frontend (from frontend/ directory)
npm start                    # Runs on PORT 3000
npm run build                # Production build

# Install dependencies
npm install
```

### Full Stack Development
```bash
# Run both services concurrently (from root)
cd backend && npm run dev &
cd frontend && npm start &
```

## Architecture Overview

### Core Domain Models
- **Provider**: Healthcare providers with complex scheduling configurations
  - Timezone-aware scheduling with recurring rules (days of week, time slots)
  - Exception handling for holidays/special availability
  - Configurable slot durations, notice periods, and booking horizons
- **Patient**: Basic patient information
- **Booking**: Appointment bookings linking providers and patients with UTC timestamps
- **ProviderConfig**: Embedded scheduling configuration with recurring rules and exceptions

### Key Components
- **Slot Generation Engine** (`lib/generateSlotsForRange.js`): Core scheduling logic that generates available time slots considering:
  - Provider timezone conversion
  - Recurring scheduling rules by day of week
  - Schedule exceptions (blackouts and special availability)
  - Existing booking conflicts
  - Notice periods and booking horizons

### API Structure
```
/api/providers              # Provider CRUD operations
  GET /                     # List all providers
  POST /                    # Create provider
  PUT /:id/config          # Update schedule configuration
  GET /:id/availability    # Get availability slots

/api/patients              # Patient management  
  GET /, POST /, GET /:id

/api/bookings              # Booking operations
  POST /                   # Create booking
  PATCH /:id/cancel       # Cancel booking

/api/schedule             # Schedule queries
  GET /available          # Get available slots by date range
```

### Database Schema
- **MongoDB** with Mongoose ODM
- **Timezone handling**: All slots computed in provider's local timezone, stored as UTC
- **Recurring rules**: Array of day-of-week based scheduling patterns
- **Exceptions**: Date-specific overrides for holidays or special hours

### Key Libraries
- **Luxon**: Timezone-aware date/time operations (critical for slot generation)
- **Express**: RESTful API framework
- **Mongoose**: MongoDB object modeling
- **React Big Calendar**: Frontend calendar component

## Development Patterns

### Timezone Handling
All scheduling logic operates in provider's configured timezone and converts to UTC for storage. The slot generation process:
1. Converts UTC queries to provider's local date range
2. Applies recurring rules and exceptions in provider timezone
3. Returns slots with UTC timestamps for API consistency

### Schedule Configuration
Providers have nested `scheduleConfig` containing:
- `timezone`: IANA timezone identifier
- `recurringRules`: Array of weekly scheduling patterns
- `exceptions`: Date-specific schedule overrides
- `minNoticeMinutes`, `maxDaysAhead`: Booking constraints

### Booking Validation
Booking creation validates:
- Slot availability (no overlapping bookings)
- Notice period requirements
- Booking horizon limits
- Provider schedule compliance

## Environment Configuration

### Backend (.env)
```
MONGODB_URI=mongodb://127.0.0.1:27017/sandbox_scheduler
PORT=4000
```

### Frontend
- Runs on PORT 3000 by default
- Connects to backend on localhost:4000

## Database Seeding

Use `seed.js` to create a test provider with:
- Mon-Fri 9:00-12:00 and 13:00-17:00 availability
- 30-minute slots
- UTC timezone
- Sample holiday exception

Use `seed-patient.js` for test patient data.
