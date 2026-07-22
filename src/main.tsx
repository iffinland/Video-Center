// Video Center — application entry point with Home display settings

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import {
  loadHomeDisplaySettings,
  applyHomeDisplaySettings,
  readHomeDisplaySettingsFromUrl,
} from './services/qortium/homeDisplaySettings';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Ensure index.html contains <div id="root"></div>.');
}

// Apply initial display settings from URL params (Home injects these)
const initialSettings = readHomeDisplaySettingsFromUrl(window.location.search);
applyHomeDisplaySettings(initialSettings, document.documentElement);

// Load live settings from Home bridge
loadHomeDisplaySettings(initialSettings)
  .then((live) => {
    applyHomeDisplaySettings(live, document.documentElement);
  })
  .catch(() => {
    // Bridge unavailable — keep URL-based settings
  });

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
