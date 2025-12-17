import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron and Extension compatibility
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // Increase limit to 1000kB to suppress warnings for desktop app
  },
  server: {
    port: 5173
  }
});