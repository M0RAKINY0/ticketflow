import { createBrowserRouter, Link, Navigate, type RouteObject } from 'react-router-dom';

import { LoginPage } from '../auth/LoginPage';
import { RegisterPage } from '../auth/RegisterPage';
import { AnonymousOnly, RequireRole, RequireUser } from '../auth/guards';
import { AppShell } from '../components/layout/AppShell';
import { DiscoveryPage } from '../features/discovery/DiscoveryPage';
import { EventDetailPage } from '../features/discovery/EventDetailPage';

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DiscoveryPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      {
        element: <AnonymousOnly />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireUser />,
        children: [
          { path: 'tickets', element: <RoutePlaceholder title="My tickets" /> },
          { path: 'account', element: <RoutePlaceholder title="My account" /> },
        ],
      },
      {
        element: <RequireUser />,
        children: [
          { path: 'organizer/events', element: <RoutePlaceholder title="Your events" /> },
          { path: 'organizer/scan', element: <RoutePlaceholder title="Check in guests" /> },
        ],
      },
      {
        element: <RequireRole roles={['ADMIN']} />,
        children: [{ path: 'admin', element: <RoutePlaceholder title="Administration" /> }],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);

function RoutePlaceholder({ title }: { title: string }) {
  return <main className="route-placeholder page-width"><h1>{title}</h1><p>This workspace is ready for its next end-to-end product layer.</p><Link className="text-link" to="/">Back to explore</Link></main>;
}
