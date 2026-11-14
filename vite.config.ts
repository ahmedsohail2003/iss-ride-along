/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// plain .mjs helper shared with scripts/smoke.mjs (this file is not in tsconfig's "include")
import { SOURCE_HASH_META, sourceHash } from './scripts/source-hash.mjs';

// base './' + singlefile: the build is one self-contained index.html that also opens from file://
// The source fingerprint meta lets smoke.mjs refuse a page built from older source.
export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile(),
    {
      name: 'iss-source-hash',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { name: SOURCE_HASH_META, content: sourceHash() }, injectTo: 'head' },
      ],
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
