import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Build content script separately with different config
const isContentBuild = process.env.BUILD_TARGET === 'content';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: !isContentBuild, // Don't empty when building content separately
    rollupOptions: isContentBuild
      ? {
          // Content script build - inline everything, no code splitting
          input: {
            content: resolve(__dirname, 'src/content/content.js'),
          },
          output: {
            format: 'iife',
            entryFileNames: '[name].js',
            inlineDynamicImports: true,
          },
        }
      : {
          // Main build - background, popup, options, sidepanel
          input: {
            background: resolve(__dirname, 'src/background/background.js'),
            popup: resolve(__dirname, 'src/popup/popup.html'),
            options: resolve(__dirname, 'src/options/options.html'),
            sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
            ui: resolve(__dirname, 'src/content/ui.css'),
            expandPanel: resolve(__dirname, 'src/content/expandPanel.css'),
          },
          output: {
            entryFileNames: (chunkInfo) => {
              if (chunkInfo.name === 'background') {
                return '[name].js';
              }
              return 'assets/[name]-[hash].js';
            },
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: (assetInfo) => {
              if (assetInfo.name === 'ui.css' || assetInfo.name === 'expandPanel.css') {
                return 'assets/[name][extname]';
              }
              if (assetInfo.name?.endsWith('.html')) {
                return '[name][extname]';
              }
              return 'assets/[name][extname]';
            },
          },
        },
    copyPublicDir: !isContentBuild,
  },
  publicDir: 'public',
  plugins: isContentBuild
    ? []
    : [
        {
          name: 'copy-manifest',
          closeBundle() {
            copyFileSync(
              resolve(__dirname, 'manifest.json'),
              resolve(__dirname, 'dist/manifest.json')
            );
          },
        },
      ],
});
