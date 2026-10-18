import test from 'node:test';
import assert from 'node:assert/strict';
import { containAuthDialogFocus, focusAuthDialog } from '../src/utils/authDialogFocus.js';
function harness() {
  const handlers = new Map();
  const document = { activeElement: null, addEventListener: (key, handler) => handlers.set(key, handler), removeEventListener: (key) => handlers.delete(key) };
  const control = (id, tagName = 'BUTTON', type = '') => ({ id, tagName, type, tabIndex: 0, isConnected: true, getClientRects: () => [{}], focus() { document.activeElement = this; } });
  const trigger = control('open'); const close = control('close'); const email = control('email', 'INPUT', 'email'); const submit = control('submit');
  let controls = [close, email, submit];
  const dialog = { ownerDocument: document, querySelectorAll: () => controls, contains: (node) => controls.includes(node), focus() { document.activeElement = dialog; } };
  document.activeElement = trigger;
  const key = (key, shiftKey = false) => { const event = { key, shiftKey, preventDefault() { this.prevented = true; }, stopPropagation() {} }; handlers.get('keydown')(event); return event; };
  return { document, handlers, trigger, close, email, submit, dialog, key, setControls: (next) => { controls = next; } };
}
test('auth dialog focuses email, loops keyboard focus, escapes and restores its trigger', () => {
  const h = harness(); let escaped = 0;
  const release = containAuthDialogFocus(h.dialog, () => escaped++);
  assert.equal(h.document.activeElement, h.email);
  h.submit.focus(); assert.equal(h.key('Tab').prevented, true); assert.equal(h.document.activeElement, h.close);
  assert.equal(h.key('Tab', true).prevented, true); assert.equal(h.document.activeElement, h.submit);
  h.trigger.focus(); h.key('Tab'); assert.equal(h.document.activeElement, h.close);
  h.key('Escape'); assert.equal(escaped, 1);
  release(); assert.equal(h.document.activeElement, h.trigger); assert.equal(h.handlers.size, 0);
});
test('auth view changes focus the new input without losing the original return target', () => {
  const h = harness(); const release = containAuthDialogFocus(h.dialog, () => {});
  const next = { ...h.email, id: 'reset-email', focus() { h.document.activeElement = this; } };
  h.setControls([h.close, next]); focusAuthDialog(h.dialog); assert.equal(h.document.activeElement, next);
  release(); assert.equal(h.document.activeElement, h.trigger);
});
test('removed invokers are not focused and an empty dialog remains keyboard contained', () => {
  const h = harness(); const release = containAuthDialogFocus(h.dialog, () => {});
  h.trigger.isConnected = false; h.setControls([]);
  assert.equal(h.key('Tab').prevented, true); assert.equal(h.document.activeElement, h.dialog);
  release(); assert.equal(h.document.activeElement, h.dialog);
});
