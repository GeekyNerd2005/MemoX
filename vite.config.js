import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: './', 
  build: {
    outDir: 'dist', 
    emptyOutDir: true, 
    target: 'esnext', 
    minify: false, 

    rollupOptions: {
      input: {
        background: resolve(__dirname, 'background.js'),
        content: resolve(__dirname, 'content.js'),
        offscreen: resolve(__dirname, 'offscreen.js'), 
        popup: resolve(__dirname, 'popup.js'), 
      },
      output: {
        entryFileNames: '[name].js', 
        chunkFileNames: 'assets/[name].js', 
        assetFileNames: 'assets/[name].[ext]' 
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: resolve(__dirname, 'manifest.json'),
          dest: '' 
        },
        {
          src: resolve(__dirname, 'popup.html'), 
          dest: ''
        },
        {
          src: resolve(__dirname, 'offscreen.html'), 
          dest: ''
        },
      ]
    })
  ]
});