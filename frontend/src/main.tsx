import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler for WebGL context errors
window.addEventListener('error', (event) => {
  // Suppress WebGL context errors that happen during resize/unmount
  if (
    event.message?.includes('maxTextureDimension2D') ||
    event.message?.includes('WebGL context') ||
    event.message?.includes('getMaxDrawingBufferSize')
  ) {
    console.warn('Suppressed WebGL error during component lifecycle:', event.message);
    event.preventDefault();
    return false;
  }
});

// Global unhandled rejection handler
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('WebGL') ||
    event.reason?.message?.includes('maxTextureDimension2D')
  ) {
    console.warn('Suppressed WebGL promise rejection:', event.reason);
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
