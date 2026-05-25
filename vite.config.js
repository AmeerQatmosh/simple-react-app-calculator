import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Must match GitHub Pages project URL (see package.json "homepage").
// Use `/` in dev (`vite`) for simpler local URLs; use repo path only for `vite build`.
const repoBase = '/simple-react-app-calculator/';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? repoBase : '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
}));
