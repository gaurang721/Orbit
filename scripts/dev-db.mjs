// Local dev convenience: run a real, portable PostgreSQL (no Docker required)
// using the `embedded-postgres` package. Keeps running until killed.
//
//   node scripts/dev-db.mjs
//
// Connects on localhost:5432 with the credentials from .env.example, and ensures
// the `fbclone` database exists. Data is stored in ./.pgdata (gitignored).
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'fbclone',
  password: 'fbclone_dev_password',
  port: 5432,
  persistent: true,
});

const alreadyInitialised = existsSync(path.join(dataDir, 'PG_VERSION'));
if (!alreadyInitialised) {
  console.log('• initialising PostgreSQL data dir…');
  await pg.initialise();
}

console.log('• starting PostgreSQL on :5432…');
await pg.start();

// Create the DB with UTF8 (Windows clusters default to WIN1252, which can't
// store emoji). Falls back to the plain helper if a raw client isn't available.
try {
  if (typeof pg.getPgClient === 'function') {
    const client = pg.getPgClient();
    await client.connect();
    try {
      await client.query(
        "CREATE DATABASE fbclone ENCODING 'UTF8' TEMPLATE template0 LC_CTYPE 'C' LC_COLLATE 'C'",
      );
      console.log('• created database "fbclone" (UTF8)');
    } finally {
      await client.end();
    }
  } else {
    await pg.createDatabase('fbclone');
    console.log('• created database "fbclone"');
  }
} catch {
  console.log('• database "fbclone" already exists');
}

console.log('READY — PostgreSQL is up. Press Ctrl+C to stop.');

async function shutdown() {
  console.log('\n• stopping PostgreSQL…');
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// keep the process alive
setInterval(() => {}, 1 << 30);
