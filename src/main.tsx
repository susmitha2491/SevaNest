import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { logger } from './core/logging/logger';
import { env } from './core/config/env';

logger.info(`Starting SevaNest Web Admin Portal [Environment: ${env.VITE_APP_ENV}]`);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root mounting element in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
