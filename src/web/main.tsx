import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { Docs } from './Docs.tsx';
import { I18nProvider } from './I18nProvider.tsx';
import { Landing } from './Landing.tsx';
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

createRoot(root).render(
  <StrictMode>
    <I18nProvider>{render()}</I18nProvider>
  </StrictMode>,
);
