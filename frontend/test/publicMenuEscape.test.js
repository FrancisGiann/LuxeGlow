import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPublicMenuEscape } from '../src/utils/publicMenuEscape.js';

function keyEvent(key) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  return event;
}

test('Escape closes the public menu and restores trigger focus', () => {
  const target = new EventTarget();
  const calls = [];
  const cleanup = bindPublicMenuEscape({ target, onClose: () => calls.push('close'), trigger: { focus: () => calls.push('focus') } });
  const event = keyEvent('Escape');
  target.dispatchEvent(event);
  assert.deepEqual(calls, ['close', 'focus']);
  assert.equal(event.defaultPrevented, true);
  cleanup();
});

test('Tab, Enter and already-handled Escape retain their behavior', () => {
  const target = new EventTarget();
  let closed = 0;
  const cleanup = bindPublicMenuEscape({ target, onClose: () => closed++ });
  for (const key of ['Tab', 'Enter']) {
    const event = keyEvent(key);
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  const handled = keyEvent('Escape');
  handled.preventDefault();
  target.dispatchEvent(handled);
  assert.equal(closed, 0);
  cleanup();
});

test('cleanup removes the listener when the menu closes or unmounts', () => {
  const target = new EventTarget();
  let closed = 0;
  const cleanup = bindPublicMenuEscape({ target, onClose: () => closed++ });
  cleanup();
  const event = keyEvent('Escape');
  target.dispatchEvent(event);
  assert.equal(closed, 0);
  assert.equal(event.defaultPrevented, false);
});
