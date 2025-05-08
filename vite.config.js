import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'anytts.chromium', // Output directory for the build
    modulePreload: {
      polyfill: false, // Disable polyfills for module preload
    },
    sourcemap: false, // Generate source maps for easier debugging
    rollupOptions: {
      input: {
        popup: 'popup.html',
        panel: 'panel.html',
        options: 'options.html',
        offscreen: 'offscreen.html',
        background: 'src/background.js',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },

  // Silence Sass deprecation warnings.
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: [
          'import',
          'mixed-decls',
          'color-functions',
          'global-builtin',
        ],
      },
    },
  },
});