// One-off: recreate the `fbclone` database with UTF8 encoding.
// The Windows embedded-postgres cluster defaults new DBs to WIN1252, which
// cannot store emoji / 4-byte UTF-8. Run with the API stopped.
import { PrismaClient } from '@prisma/client';

const adminUrl = 'postgresql://fbclone:fbclone_dev_password@localhost:5432/postgres?schema=public';
const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });

try {
  await admin.$executeRawUnsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'fbclone' AND pid <> pg_backend_pid()`,
  );
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "fbclone"`);
  await admin.$executeRawUnsafe(
    `CREATE DATABASE "fbclone" ENCODING 'UTF8' TEMPLATE template0 LC_CTYPE 'C' LC_COLLATE 'C'`,
  );
  console.log('✅ Recreated database "fbclone" with UTF8 encoding.');
} catch (e) {
  console.error('❌ Failed:', e.message);
  process.exit(1);
} finally {
  await admin.$disconnect();
}
