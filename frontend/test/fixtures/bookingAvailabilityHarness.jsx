import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { BookingPage } from '../../src/pages/BookingPage';
window.syntheticState = { blocked: {}, delay: 0, fail: false };
window.syntheticCalls = [];
createRoot(document.getElementById('root')).render(<MemoryRouter><BookingPage /></MemoryRouter>);
