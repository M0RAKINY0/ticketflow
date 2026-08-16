import { Compass, Plus, Ticket, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useSession } from '../../auth/SessionProvider';

export function MobileNav() {
  const session = useSession();
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavItem to="/" label="Explore" icon={<Compass />} />
      <NavItem to="/tickets" label="Tickets" icon={<Ticket />} />
      {session.status === 'authenticated' ? <NavItem to="/organizer/events" label="Create" icon={<Plus />} /> : null}
      <NavItem to={session.status === 'authenticated' ? '/account' : '/login'} label="Account" icon={<UserRound />} />
    </nav>
  );
}

function NavItem({ icon, label, to }: { icon: React.ReactElement<{ size?: number; 'aria-hidden'?: boolean }>; label: string; to: string }) {
  return <NavLink to={to}>{/* icon is decorative beside visible text */}{icon}<span>{label}</span></NavLink>;
}
