import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The interface lives in src/web; src/server/main.ts runs Vite in middleware mode.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
});
