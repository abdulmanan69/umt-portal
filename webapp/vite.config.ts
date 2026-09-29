import { defineConfig } from 'vite';

/**
 * GitHub Pages serves a project site from /<repo>/, so the base path has to
 * match the repository name. Set UMT_BASE at build time to change it.
 */
const base = process.env.UMT_BASE ?? '/umt-companion/';

const buildId = process.env.GITHUB_SHA?.slice(0, 8) ?? String(Date.now());

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(buildId)
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  },
  server: { port: 5173, open: false }
});
