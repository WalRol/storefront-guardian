import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base relativa: el mismo build funciona en GitHub Pages (/storefront-guardian/) y en local.
export default defineConfig({
  base: './',
  plugins: [react()],
});
