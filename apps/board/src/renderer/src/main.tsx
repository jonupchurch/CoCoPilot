import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App.js';

import './tokens.css';

const root = document.getElementById('root');
if (root === null) throw new Error('no #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
