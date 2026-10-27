import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional DOM runtime installed outside the repository; all API dependencies
// below are replaced with synthetic fixtures before loading the real component.
test('signup shows red unavailable feedback, retains details, and ignores stale checks', { skip: !process.env.HAPPY_DOM_MODULE }, async () => {
  const { Window } = await import(process.env.HAPPY_DOM_MODULE);
  const window = new Window({ url: 'https://synthetic.example' });
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Event', 'FocusEvent', 'FormData', 'IS_REACT_ACT_ENVIRONMENT'];
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? window : window[name] });
  const pending = [];
  let registered = 0;
  globalThis.__signupTestCheck = () => new Promise((resolve) => pending.push(resolve));
  globalThis.__signupTestAuth = {
    modalView: 'register', closeAuth() {}, openAuth() {},
    async register() { registered++; return { ok: false, emailUnavailable: true }; },
  };
  const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
  let server; let root;
  try {
    server = await createServer({ root: rootDir, configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, plugins: [{
      name: 'synthetic-signup-fixtures', enforce: 'pre',
      transform(_source, id) {
        const path = id.split('?')[0];
        if (path.endsWith('/src/context/AuthContext.jsx')) return 'export function useAuth() { return globalThis.__signupTestAuth; }';
        if (path.endsWith('/src/api/endpoints.js')) return 'export const checkSignupEmailAvailability = (...args) => globalThis.__signupTestCheck(...args);';
        if (path.endsWith('/src/components/ui/Toast.jsx')) return 'export const useToast = () => () => {};';
      },
    }] });
    const React = await import('react');
    const { act } = React;
    const { createRoot } = await import('react-dom/client');
    const { MemoryRouter } = await import('react-router-dom');
    const { AuthModal } = await server.ssrLoadModule('/src/components/auth/AuthModal.jsx');
    const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(AuthModal))));
    const email = document.querySelector('#reg-email');
    const enter = async (value) => act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(email, value);
      email.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const blur = async () => act(async () => email.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })));
    document.querySelector('#reg-first').value = 'Synthetic';
    document.querySelector('#reg-last').value = 'Customer';
    await enter('used@example.test'); await blur();
    assert.match(document.querySelector('#reg-email-feedback').textContent, /Checking email/);
    await act(async () => pending.shift()({ ok: true, available: false }));
    assert.equal(email.getAttribute('aria-invalid'), 'true');
    assert.ok(email.className.includes('border-danger'));
    assert.match(host.textContent, /unavailable for a new account/);
    assert.match(host.textContent, /Forgot password/);
    assert.equal(document.querySelector('#reg-first').value, 'Synthetic');
    await enter('next@example.test'); await blur();
    const late = pending.shift();
    await enter('latest@example.test'); await blur();
    await act(async () => late({ ok: true, available: false }));
    assert.equal(email.getAttribute('aria-invalid'), 'false');
    await act(async () => pending.shift()({ ok: false }));
    assert.equal(email.getAttribute('aria-invalid'), 'false');
    assert.match(host.textContent, /Could not check this email/);
    for (const [id, value] of [['reg-phone', '09170001122'], ['reg-pass', 'Synthetic1!'], ['reg-confirm', 'Synthetic1!']]) document.getElementById(id).value = value;
    await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(registered, 1);
    assert.equal(email.getAttribute('aria-invalid'), 'true');
    assert.equal(email.value, 'latest@example.test');
    assert.equal(document.querySelector('#reg-pass').value, 'Synthetic1!');
    await act(async () => root.unmount()); root = null;
  } finally {
    if (root) root.unmount();
    await server?.close();
    await window.happyDOM.close();
    delete globalThis.__signupTestAuth; delete globalThis.__signupTestCheck;
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
