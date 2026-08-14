import express, { type Express } from 'express';

import { success } from './shared/response.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json(success({ status: 'ok' }));
  });

  return app;
}
