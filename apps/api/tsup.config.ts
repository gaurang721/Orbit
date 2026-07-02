import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  // Inline workspace packages (consumed as TS source) so the output runs without
  // a separate build step for @fbclone/*; everything else stays external.
  noExternal: [/^@fbclone\//],
  // Prisma and native-ish deps must remain external.
  external: ['@prisma/client', '.prisma'],
});
