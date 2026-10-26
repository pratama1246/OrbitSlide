import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  build: {
    target: ['chrome108', 'es2020']
  },
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            target: ['node16', 'es2020'],
            outDir: 'dist-electron',
            lib: {
              entry: 'src/main/index.ts',
              formats: ['cjs'],
              fileName: () => 'main.cjs'
            },
            rollupOptions: {
              external: ['sql.js']
            }
          }
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            target: ['chrome108', 'node16', 'es2020'],
            outDir: 'dist-electron',
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs'
            }
          }
        }
      }
    ])
  ]
});
