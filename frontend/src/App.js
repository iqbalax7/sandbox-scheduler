import React, { useEffect, useState } from 'react';
import CalendarView from './components/CalendarView';
import API from './api';

export default function App() {
  const [provider, setProvider] = useState(null);
  const [providersList, setProvidersList] = useState([]);

  useEffect(() => {
    // create demo providers on first load if none exist
    (async () => {
      try {
        const res = await API.get('/providers'); // We'll implement /providers list endpoint shortly
        setProvidersList(res.data.data); // API returns {success, count, data: [...]} structure
        if (res.data.data.length > 0) setProvider(res.data.data[0]);
      } catch (err) {
        console.warn('No providers list endpoint — creating sample provider...');
        // create sample provider
        const sampleConfig = {
          timezone: 'Asia/Karachi',
          recurringRules: [
            { daysOfWeek: [1,2,3,4,5], startTime: '09:00', endTime: '17:00', slotDuration: 30 }
          ],
          minNoticeMinutes: 15,
          maxDaysAhead: 30
        };
        const r = await API.post('/providers', { name: 'Dr. Khan (PK)', email: 'khan@pk.test', scheduleConfig: sampleConfig });
        const r2 = await API.post('/providers', { name: 'Dr. Lee (Hawaii)', email: 'lee@hi.test', scheduleConfig: { ...sampleConfig, timezone: 'Pacific/Honolulu' } });
        setProvidersList([r.data, r2.data]);
        setProvider(r.data);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h2>Sandbox Scheduler — Provider availability (no persisted empty slots)</h2>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label>Select provider</label>
          <select value={provider?._id || ''} onChange={e => {
            const p = Array.isArray(providersList) ? providersList.find(x => x._id === e.target.value) : null;
            setProvider(p);
          }}>
            {Array.isArray(providersList) ? providersList.map(p => <option key={p._id} value={p._id}>{p.name}</option>) : null}
          </select>
        </div>
      </div>

      {provider && <CalendarView provider={provider} />}
    </div>
  );
}
