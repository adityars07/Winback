import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5500,
    proxy: {
      '/api': 'http://localhost:8000',
      '/transactions': 'http://localhost:8000',
      '/summary': 'http://localhost:8000',
      '/audit-events': 'http://localhost:8000',
      '/run-batch': 'http://localhost:8000',
      '/reset': 'http://localhost:8000',
      '/export': 'http://localhost:8000',
    },
  },
});
