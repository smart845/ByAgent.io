import { defineConfig } from 'vite'; 
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public', // чтобы Vercel видел public/_redirects
  build: {
    outDir: '../dist', // билд пойдет в dist/
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/bybit': {
        target: 'https://api.bybit.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/bybit/, ''),
      },
    },
  },
});
