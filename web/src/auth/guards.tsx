import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { Role } from '../api/types';
import { useSession } from './SessionProvider';

export function RequireUser() {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <SessionLoading />;
  if (session.status === 'anonymous') {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const session = useSession();
  if (session.status === 'loading') return <SessionLoading />;
  if (session.status !== 'authenticated' || !roles.includes(session.user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function AnonymousOnly() {
  const session = useSession();
  if (session.status === 'loading') return <SessionLoading />;
  return session.status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />;
}

export function safeReturnTo(value: string | null | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function SessionLoading() {
  return (
    <main className="session-loading" aria-live="polite">
      <span className="session-loading__mark" aria-hidden="true" />
      <p>Checking your Ventra session…</p>
    </main>
  );
}
