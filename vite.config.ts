/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' + singlefile: the build is one self-contained index.html that also opens from file://
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
