/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initConsoleInterceptor } from './store/useLogStore';

initConsoleInterceptor();

// ─── Suppress known upstream library warnings ──────────────────────────────
// THREE.Clock deprecation: R3F v9 still uses THREE.Clock internally; Three.js
// v0.184+ deprecated it in favor of THREE.Timer. This is an upstream R3F issue.
// Rapier deprecated params: @react-three/rapier uses the old initialization API.
// Neither warning affects functionality — suppress to keep console clean.
const _originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg.includes('THREE.Clock: This module has been deprecated') ||
    msg.includes('using deprecated parameters for the initialization function') ||
    msg.includes('THREE.WebGLProgram: Program Info Log:') ||
    msg.includes('warning X4122:') ||
    msg.includes('THREE.Color: Unknown color')
  ) {
    return; // Silently suppress known upstream warnings
  }
  _originalWarn.apply(console, args);
};

const _originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : (args[0] && (args[0] as any).message) || '';
  if (msg.includes('Expected static flag was missing')) {
    return; // Suppress React DevTools internal static flag warning
  }
  _originalError.apply(console, args);
};

// Validate required environment variables
const REQUIRED_ENV_VARS = ['VITE_API_URL']; // Example fallback for API routes
REQUIRED_ENV_VARS.forEach((key) => {
  if (!import.meta.env[key]) {
    console.warn(`[Security Audit] Missing environment variable: ${key}`);
  }
});

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
