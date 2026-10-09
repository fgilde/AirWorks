import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/AirWorks/' : '/',
  build: {
    rollupOptions: {
      input: {
        docs: resolve(__dirname, 'index.html'),
        docsDe: resolve(__dirname, 'de.html'),
        webtop: resolve(__dirname, 'webtop.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 4173 },
});
