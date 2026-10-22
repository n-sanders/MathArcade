import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the built `dist/` folder works from any static host or subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
