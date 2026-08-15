import { Outlet } from 'react-router-dom';

import { MobileNav } from './MobileNav';
import { PublicHeader } from './PublicHeader';

export function AppShell() {
  return <div className="app-shell"><PublicHeader /><Outlet /><MobileNav /></div>;
}
