import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Vite config for Vision RPS 2.0.
// - Root is the project root; index.html at root.
// - Vendored MediaPipe ESM bundle is kept out of the dependency optimizer
//   (it is prebuilt). We alias the import specifier to it.
// - Build outputs to dist/ for static (Cloudflare Pages) hosting.
export default defineConfig({
  resolve: {
    alias: {
      '@mediapipe/tasks-vision': fileURLToPath(
        new URL('./public/vendor/vision_bundle.mjs', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    port: 8000,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
