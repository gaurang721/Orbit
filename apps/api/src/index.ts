import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { startServer } from './server.js';

async function main(): Promise<void> {
  const app = createApp();
  await startServer(app);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
