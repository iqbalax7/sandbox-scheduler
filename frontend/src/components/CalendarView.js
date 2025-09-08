import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';
import { DateTime } from 'luxon';
import API from '../api';

import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const CalendarView = ({ provider }) => {
  const [events, setEvents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, available: 0, booked: 0 });

  // Calculate date range based on current view
  const dateRange = useMemo(() => {
    const start = DateTime.fromJSDate(currentDate)
      .setZone(provider?.scheduleConfig?.timezone || 'UTC')
      .startOf(view === 'month' ? 'month' : 'week')
      .minus({ days: 1 }) // Buffer
      .toUTC();
    
    const end = DateTime.fromJSDate(currentDate)
      .setZone(provider?.scheduleConfig?.timezone || 'UTC')
      .endOf(view === 'month' ? 'month' : 'week')
      .plus({ days: view === 'month' ? 7 : 14 }) // Extended range
      .toUTC();
    
    return {
      from: start.toISO(),
      to: end.toISO()
    };
  }, [currentDate, view, provider?.scheduleConfig?.timezone]);

  // Fetch patients
  useEffect(() => {
    const loadPatients = async () => {
      try {
        const res = await API.get('/patients');
        const patientList = res.data.data || res.data || [];
        setPatients(patientList);
        if (patientList.length > 0 && !selectedPatient) {
          setSelectedPatient(patientList[0]);
        }
      } catch (err) {
        console.error('Failed to fetch patients:', err);
        setError('Could not load patients');
      }
    };
    loadPatients();
  }, [selectedPatient]);

  // Fetch availability when provider or date range changes
  useEffect(() => {
    if (!provider?._id) return;
    
    const loadAvailability = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Loading availability for ${provider.name} from ${dateRange.from} to ${dateRange.to}`);
        
        const res = await API.get(`/providers/${provider._id}/availability`, {
          params: { 
            from: dateRange.from, 
            to: dateRange.to 
          },
        });
        
        console.log('Availability response:', res.data);
        
        const slots = res.data.data?.slots || res.data.slots || [];
        
        // Map slots to calendar events with enhanced information
        const mapped = slots.map((slot) => {
          const isException = slot.isException || false;
          const localTime = DateTime.fromISO(slot.start)
            .setZone(provider.scheduleConfig?.timezone || 'UTC')
            .toFormat('h:mm a');
          
          let title, resource;
          
          if (slot.isBooked && slot.booking) {
            const patientName = slot.booking.patient 
              ? `${slot.booking.patient.first_name} ${slot.booking.patient.last_name}` 
              : 'Unknown Patient';
            title = `🔒 ${patientName}`;
            resource = 'booked';
          } else {
            title = isException 
              ? `⚠️ ${localTime} (Exception)` 
              : `✅ ${localTime}`;
            resource = isException ? 'exception' : 'available';
          }
          
          return {
            id: `${slot.start}-${slot.end}`,
            title,
            start: new Date(slot.start),
            end: new Date(slot.end),
            resource,
            isBooked: slot.isBooked,
            isException,
            booking: slot.booking,
            localTime,
            providerTimezone: provider.scheduleConfig?.timezone || 'UTC',
            exceptionNote: slot.exceptionNote
          };
        });
        
        setEvents(mapped);
        
        // Update stats
        const total = slots.length;
        const booked = slots.filter(s => s.isBooked).length;
        const available = total - booked;
        setStats({ total, available, booked });
        
      } catch (err) {
        console.error('Failed to fetch availability:', err);
        setError('Failed to load availability: ' + (err.response?.data?.error || err.message));
        setEvents([]);
        setStats({ total: 0, available: 0, booked: 0 });
      } finally {
        setLoading(false);
      }
    };
    
    loadAvailability();
  }, [provider?._id, dateRange.from, dateRange.to]);

  // Handle slot selection/booking
  const handleSelectEvent = async (event) => {
    if (event.isBooked) {
      // Show booking details
      const booking = event.booking;
      const localTime = event.localTime;
      const timezone = event.providerTimezone;
      
      alert(`This slot is already booked:\n\nPatient: ${booking?.patient?.first_name || 'Unknown'} ${booking?.patient?.last_name || ''}\nTime: ${localTime} (${timezone})\nNotes: ${booking?.notes || 'None'}`);
      return;
    }
    
    if (!selectedPatient) {
      alert('Please select a patient first.');
      return;
    }
    
    const confirmBooking = window.confirm(
      `Book appointment for ${selectedPatient.first_name} ${selectedPatient.last_name}?\n\nTime: ${event.localTime} (${event.providerTimezone})\nProvider: ${provider.name}${event.isException ? '\n\n⚠️ This is an exception slot' : ''}`
    );
    
    if (!confirmBooking) return;
    
    try {
      setLoading(true);
      
      await API.post('/bookings', {
        providerId: provider._id,
        patientId: selectedPatient._id,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        notes: event.isException ? `Exception booking: ${event.exceptionNote || ''}` : ''
      });
      
      alert('✅ Appointment booked successfully!');
      
      // Refresh the calendar
      const res = await API.get(`/providers/${provider._id}/availability`, {
        params: { 
          from: dateRange.from, 
          to: dateRange.to 
        },
      });
      
      const slots = res.data.data?.slots || res.data.slots || [];
      const mapped = slots.map((slot) => {
        const isException = slot.isException || false;
        const localTime = DateTime.fromISO(slot.start)
          .setZone(provider.scheduleConfig?.timezone || 'UTC')
          .toFormat('h:mm a');
        
        let title, resource;
        
        if (slot.isBooked && slot.booking) {
          const patientName = slot.booking.patient 
            ? `${slot.booking.patient.first_name} ${slot.booking.patient.last_name}` 
            : 'Unknown Patient';
          title = `🔒 ${patientName}`;
          resource = 'booked';
        } else {
          title = isException 
            ? `⚠️ ${localTime} (Exception)` 
            : `✅ ${localTime}`;
          resource = isException ? 'exception' : 'available';
        }
        
        return {
          id: `${slot.start}-${slot.end}`,
          title,
          start: new Date(slot.start),
          end: new Date(slot.end),
          resource,
          isBooked: slot.isBooked,
          isException,
          booking: slot.booking,
          localTime,
          providerTimezone: provider.scheduleConfig?.timezone || 'UTC',
          exceptionNote: slot.exceptionNote
        };
      });
      
      setEvents(mapped);
      
      // Update stats
      const total = slots.length;
      const booked = slots.filter(s => s.isBooked).length;
      const available = total - booked;
      setStats({ total, available, booked });
      
    } catch (err) {
      console.error('Booking failed:', err);
      alert('❌ Booking failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Custom event styling
  const eventStyleGetter = (event) => {
    let backgroundColor, color, border;
    
    switch (event.resource) {
      case 'booked':
        backgroundColor = '#dc3545';
        color = 'white';
        border = '1px solid #c82333';
        break;
      case 'exception':
        backgroundColor = '#fd7e14';
        color = 'white';
        border = '1px solid #e06300';
        break;
      default: // available
        backgroundColor = '#28a745';
        color = 'white';
        border = '1px solid #1e7e34';
        break;
    }
    
    return {
      style: {
        backgroundColor,
        color,
        border,
        borderRadius: '4px',
        fontSize: '12px',
        padding: '2px 4px'
      }
    };
  };

  const handleNavigate = (date) => {
    setCurrentDate(date);
  };

  const handleViewChange = (newView) => {
    setView(newView);
  };

  if (!provider) {
    return (
      <div className="calendar-container">
        <div className="no-provider">Please select a provider to view availability.</div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-controls">
        <div className="patient-selector">
          <label>👤 Select Patient:</label>
          <select 
            value={selectedPatient?._id || ''} 
            onChange={e => {
              const patient = patients.find(p => p._id === e.target.value);
              setSelectedPatient(patient);
            }}
            className="patient-dropdown"
          >
            <option value="">-- Choose patient --</option>
            {patients.map(p => (
              <option key={p._id} value={p._id}>
                {p.first_name} {p.last_name} ({p.timezone || 'UTC'})
              </option>
            ))}
          </select>
        </div>
        
        <div className="view-controls">
          <button 
            onClick={() => handleViewChange('week')} 
            className={view === 'week' ? 'active' : ''}
          >
            📅 Week
          </button>
          <button 
            onClick={() => handleViewChange('month')} 
            className={view === 'month' ? 'active' : ''}
          >
            📆 Month
          </button>
        </div>
        
        <div className="stats">
          <span className="stat available">✅ {stats.available} Available</span>
          <span className="stat booked">🔒 {stats.booked} Booked</span>
          <span className="stat total">📊 {stats.total} Total</span>
        </div>
      </div>
      
      {error && <div className="error">❌ {error}</div>}
      {loading && <div className="loading">🔄 Loading...</div>}
      
      <div className="legend">
        <span className="legend-item available">✅ Available</span>
        <span className="legend-item exception">⚠️ Exception</span>
        <span className="legend-item booked">🔒 Booked</span>
      </div>
      
      <div className="calendar-wrapper">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          view={view}
          onView={handleViewChange}
          date={currentDate}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          popup={true}
          step={30}
          timeslots={2}
          min={new Date(2025, 0, 1, 6, 0)} // 6 AM
          max={new Date(2025, 0, 1, 22, 0)} // 10 PM
          formats={{
            timeGutterFormat: (date, culture, localizer) => 
              localizer.format(date, 'h:mm A', culture),
            eventTimeRangeFormat: ({ start, end }, culture, localizer) => 
              `${localizer.format(start, 'h:mm A', culture)} - ${localizer.format(end, 'h:mm A', culture)}`
          }}
        />
      </div>
      
      <div className="timezone-info">
        🌍 All times shown in provider timezone: <strong>{provider.scheduleConfig?.timezone || 'UTC'}</strong>
      </div>
    </div>
  );
};

export default CalendarView;
