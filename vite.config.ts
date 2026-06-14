import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during developer edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during developer edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/database.json']
      },
    },
  };
});
