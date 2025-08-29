import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
