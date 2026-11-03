import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { Docs } from './Docs.tsx';
import { I18nProvider } from './I18nProvider.tsx';
import { Landing } from './Landing.tsx';
import { MotionProvider } from './motion.tsx';
import { Owner } from './Owner.tsx';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Missing #root element in index.html');
}

// Four pages do not justify a router dependency: the path picks the page.
const PAGES: Readonly<Record<string, () => JSX.Element>> = {
  '/app': () => <App />,
  '/docs': () => <Docs />,
  '/owner': () => <Owner />,
};
const render =
  PAGES[window.location.pathname.replace(/\/+$/, '')] ?? ((): JSX.Element => <Landing />);

// For the developers who open the console: who built this, and where to find them.
// eslint-disable-next-line no-console -- a deliberate greeting, not leftover debugging
console.info(
  '%cDevPulse%c\nReading the console? You are my kind of visitor.\nBuilt by Brahim NAJI · https://github.com/BrahimNJ · https://linkedin.com/in/brahimnaji',
  'font: 700 20px "Space Grotesk Variable", sans-serif; color: #9cbcff',
  'font: 13px "Inter Variable", sans-serif; line-height: 1.6',
);

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <MotionProvider>{render()}</MotionProvider>
    </I18nProvider>
  </StrictMode>,
);
