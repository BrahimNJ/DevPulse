import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { Landing } from './Landing.tsx';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Missing #root element in index.html');
}

// Two pages do not justify a router: the landing page on /, the analyser on /app.
const isApp = window.location.pathname.startsWith('/app');
document.title = isApp ? 'DevPulse · Analyse a repository' : 'DevPulse · Repository analytics';

createRoot(root).render(<StrictMode>{isApp ? <App /> : <Landing />}</StrictMode>);
