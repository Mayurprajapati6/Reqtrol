import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        proxyTimeout: 5000,
        timeout: 5000,
        configure: (proxy) => {
          // Silence ECONNREFUSED noise during backend startup / nodemon restarts.
          // The frontend will automatically retry on the next poll interval.
          proxy.on('error', (err) => {
            if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') return;
            console.error('[proxy]', err.message);
          });
        },
      },
    },
  },
});

