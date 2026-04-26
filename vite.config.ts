import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: "./",
    plugins: [react()],
    build: {
      outDir: "QGISIA2/web",
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            core: ["react", "react-dom", "motion/react"],
            markdown: ["react-markdown", "react-syntax-highlighter"],
            maps: ["leaflet", "react-leaflet", "leaflet-draw", "@turf/turf"],
            ai: ["@google/genai"],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
