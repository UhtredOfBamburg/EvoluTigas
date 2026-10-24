import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      const file = String(event.filename || '');
      if (msg === 'Script error.' || file.includes('@vite/client')) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = String(event.reason?.stack || event.reason?.message || event.reason || '');
      if (reason.includes('@vite/client') || reason.includes('WebSocket') || reason.includes('Worker was destroyed')) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

