import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {ToastProvider} from '../src/components/ui/Toast';
import {AdminPage} from '../src/pages/AdminPage';
import {MyAppointmentsPage} from '../src/pages/dashboard/MyAppointmentsPage';
import '../src/styles/theme.css';
// Auth, all API modules and notification hooks are replaced by local fixtures.
// Prevent any accidental client fetch from reaching a remote service.
window.fetch=async()=>{throw new Error('Network disabled in synthetic fixture');};
const customer=new URLSearchParams(location.search).get('view')==='customer';
createRoot(document.getElementById('root')).render(<MemoryRouter><ToastProvider><div className="border-b border-line bg-blush-50 px-4 py-2 text-sm font-semibold text-brand-800">Synthetic UI QA · fake data · no database or messaging connections</div>{customer?<main className="min-h-screen bg-canvas p-4 sm:p-8"><MyAppointmentsPage/></main>:<AdminPage/>}</ToastProvider></MemoryRouter>);
