import React, { useEffect, useState } from 'react';
import CalendarView from './components/CalendarView';
import API from './api';
import './App.css';

const formatScheduleRules = (rules) => {
  if (!rules || rules.length === 0) return 'No recurring schedule';
  
  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  return rules.map(rule => {
    const days = rule.daysOfWeek.map(d => dayNames[d]).join(', ');
    return `${days}: ${rule.startTime}-${rule.endTime} (${rule.slotDuration}min slots)`;
  }).join(' | ');
};

const formatExceptions = (exceptions) => {
  if (!exceptions || exceptions.length === 0) return 'No exceptions';
  
  return exceptions.map(ex => {
    const status = ex.available 
      ? (ex.startTime && ex.endTime ? `Modified hours: ${ex.startTime}-${ex.endTime}` : 'Available')
      : 'Unavailable';
    return `${ex.date}: ${status}${ex.note ? ` (${ex.note})` : ''}`;
  }).join(' | ');
};

export default function App() {
  const [provider, setProvider] = useState(null);
  const [providersList, setProvidersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        const res = await API.get('/providers');
        console.log('Providers loaded:', res.data);
        
        const providers = res.data.data || [];
        setProvidersList(providers);
        
        if (providers.length > 0) {
          // Auto-select the first provider
          setProvider(providers[0]);
        } else {
          setError('No providers found. Please add some providers to the system.');
        }
      } catch (err) {
        console.error('Failed to load providers:', err);
        setError('Failed to load providers: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Loading providers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="error">❌ {error}</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏥 Healthcare Scheduling System</h1>
        <p>Cross-timezone appointment booking with recurring schedules and exceptions</p>
      </header>

      <div className="provider-section">
        <div className="provider-selector">
          <label htmlFor="provider-select">📋 Select Provider:</label>
          <select 
            id="provider-select"
            className="provider-dropdown"
            value={provider?._id || ''} 
            onChange={e => {
              const selectedProvider = Array.isArray(providersList) 
                ? providersList.find(x => x._id === e.target.value) 
                : null;
              setProvider(selectedProvider);
            }}
          >
            <option value="">-- Choose a provider --</option>
            {Array.isArray(providersList) ? 
              providersList.map(p => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.scheduleConfig?.timezone || 'UTC'})
                </option>
              )) : null
            }
          </select>
        </div>

        {provider && (
          <div className="provider-details">
            <div className="provider-info">
              <h3>👨‍⚕️ {provider.name}</h3>
              <div className="provider-meta">
                <span className="timezone">🌍 {provider.scheduleConfig?.timezone || 'UTC'}</span>
                <span className="notice">⏰ {provider.scheduleConfig?.minNoticeMinutes || 0} min notice</span>
                <span className="horizon">📅 {provider.scheduleConfig?.maxDaysAhead || 365} days ahead</span>
              </div>
            </div>
            
            <div className="schedule-info">
              <div className="schedule-rules">
                <strong>📋 Regular Schedule:</strong>
                <div className="schedule-detail">
                  {formatScheduleRules(provider.scheduleConfig?.recurringRules)}
                </div>
              </div>
              
              {provider.scheduleConfig?.exceptions?.length > 0 && (
                <div className="schedule-exceptions">
                  <strong>⚠️ Exceptions:</strong>
                  <div className="exceptions-detail">
                    {formatExceptions(provider.scheduleConfig.exceptions)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {provider ? (
        <CalendarView provider={provider} />
      ) : (
        <div className="no-provider">
          <p>Please select a provider to view their availability.</p>
        </div>
      )}
    </div>
  );
}
