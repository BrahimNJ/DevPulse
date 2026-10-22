import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The interface lives in src/web. In development src/server/dev.ts runs Vite in
// middleware mode; `npm run build` writes the production files that
// src/server/main.ts serves.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
});
