import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // `*.unit.test.ts` need no services; `*.integration.test.ts` need a database
    // (CI provisions Postgres + applies migrations). Fail loudly on an empty
    // suite rather than silently passing.
    passWithNoTests: false,
    globals: true,
    // Integration tests share one DB connection; keep file ordering deterministic.
    fileParallelism: false,
  },
});
