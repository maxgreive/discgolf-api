import app from './app';
import { databaseConfigured, databasePool } from './database';
import env from './env';
import { runDatabaseMigrations } from './migrations';

const PORT = env.PORT || 8080;

async function start() {
  if (databaseConfigured()) {
    await runDatabaseMigrations(databasePool());
  }
  app.listen(PORT, () =>
    // eslint-disable-next-line no-console
    console.log(`🥏 API running at http://localhost:${PORT}`),
  );
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
