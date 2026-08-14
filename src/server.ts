import { createApp } from './app.js';
import { env } from './config/env.js';

export async function startServer(): Promise<void> {
  const app = createApp();

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.PORT, () => resolve());
    server.once('error', reject);
  });
}

void startServer();
