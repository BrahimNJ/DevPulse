import { StrictMode, type JSX } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { Docs } from './Docs.tsx';
import { Landing } from './Landing.tsx';
import { Owner } from './Owner.tsx';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Missing #root element in index.html');
}

// Four pages do not justify a router dependency: the path picks the page.
const PAGES: Readonly<Record<string, { title: string; render: () => JSX.Element }>> = {
  '/app': { title: 'DevPulse · Analyse a repository', render: (): JSX.Element => <App /> },
  '/docs': { title: 'DevPulse · Engineering documentation', render: (): JSX.Element => <Docs /> },
  '/owner': { title: 'DevPulse · Owner access', render: (): JSX.Element => <Owner /> },
};
const path = window.location.pathname.replace(/\/+$/, '');
const page = PAGES[path] ?? {
  title: 'DevPulse · Branch health for GitHub repositories',
  render: (): JSX.Element => <Landing />,
};
document.title = page.title;

createRoot(root).render(<StrictMode>{page.render()}</StrictMode>);
