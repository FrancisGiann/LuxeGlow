import React from 'react';
import { createRoot } from 'react-dom/client';
import { AddBookingStaff } from '../../src/components/admin/AddBookingStaff';

window.syntheticRosterCalls = [];
window.syntheticRosterFail = false;
const onSave = async (fields) => {
  window.syntheticRosterCalls.push(fields);
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (window.syntheticRosterFail) throw new Error('Synthetic roster failure');
  return { success: true };
};
createRoot(document.getElementById('root')).render(<AddBookingStaff onSave={onSave} />);
