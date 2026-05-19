import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

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
      <App />
    </StrictMode>,
  );
}
