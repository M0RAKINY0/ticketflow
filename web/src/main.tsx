import '@fontsource-variable/manrope';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { queryClient } from './app/query-client';
import { SessionProvider } from './auth/SessionProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider><App /></SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
