import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { DateTime } from 'luxon';
import API from '../api';

import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarView({ provider }) {
  const [events, setEvents] = useState([]);
  const [patient, setPatient] = useState(null);
  const [rangeStart, setRangeStart] = useState(DateTime.utc().startOf('day').toISO());
  const [rangeEnd, setRangeEnd] = useState(DateTime.utc().plus({ days: 7 }).endOf('day').toISO());

  // Fetch patient once (grab first one for demo)
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/patients');
        if (res.data.length > 0) {
          setPatient(res.data[0]);
        } else {
          console.warn("⚠️ No patients found in DB. Please add one.");
        }
      } catch (err) {
        console.error("Failed to fetch patients:", err);
      }
    })();
  }, []);

  // Fetch availability when provider changes or range changes
  useEffect(() => {
    if (!provider) return;
    (async () => {
      try {
        const res = await API.get(`/providers/${provider._id}/availability`, {
          params: { from: rangeStart, to: rangeEnd },
        });
        const mapped = res.data.slots.map((s) => ({
          title: s.isBooked ? `Booked (${s.booking?.patient?.first_name || 'patient'})` : 'Available',
          start: new Date(s.start),
          end: new Date(s.end),
          isBooked: s.isBooked,
          booking: s.booking,
        }));
        setEvents(mapped);
      } catch (err) {
        console.error("Failed to fetch availability:", err);
      }
    })();
  }, [provider, rangeStart, rangeEnd]);

  // Handle booking
  const handleSelectEvent = async (event) => {
    if (event.isBooked) {
      alert("This slot is already booked");
      return;
    }
    if (!patient) {
      alert("No patient available to book. Please add a patient first.");
      return;
    }

    try {
      const res = await API.post("/bookings", {
        providerId: provider._id,
        patientId: patient._id, // dynamically fetched patient
        start: event.start.toISOString(),
        end: event.end.toISOString(),
      });
      alert("Booked successfully!");

      // Refresh availability after booking
      const refreshed = await API.get(`/providers/${provider._id}/availability`, {
        params: { from: rangeStart, to: rangeEnd },
      });
      const mapped = refreshed.data.slots.map((s) => ({
        title: s.isBooked ? `Booked (${s.booking?.patient?.first_name || 'patient'})` : 'Available',
        start: new Date(s.start),
        end: new Date(s.end),
        isBooked: s.isBooked,
        booking: s.booking,
      }));
      setEvents(mapped);
    } catch (err) {
      console.error("Booking failed:", err);
      alert("Booking failed: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ height: 600 }}>
      <Calendar
        localizer={localizer}
        defaultView="week"
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        onSelectEvent={handleSelectEvent}
      />
    </div>
  );
}
