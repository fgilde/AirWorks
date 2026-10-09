import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  publicDir: resolve(__dirname, '../../../../package'),
  build: { outDir: resolve(__dirname, '../wwwroot'), emptyOutDir: true },
});
