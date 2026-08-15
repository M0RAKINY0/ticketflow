import { CalendarPlus, LogOut, Ticket, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { useSession } from '../../auth/SessionProvider';

export function PublicHeader() {
  const session = useSession();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" to="/" aria-label="Ventra home">Ventra<span>.</span></Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavLink to="/">Explore</NavLink>
          {session.status === 'authenticated' ? <NavLink to="/tickets"><Ticket size={17} />My tickets</NavLink> : null}
          {session.status === 'authenticated' && session.user.role !== 'USER' ? <NavLink to="/organizer/events"><CalendarPlus size={17} />Create event</NavLink> : null}
        </nav>
        <div className="site-header__actions">
          {session.status === 'authenticated' ? (
            <>
              <span className="account-label"><UserRound size={17} aria-hidden="true" />{session.user.name}</span>
              <button className="header-link" type="button" onClick={() => void session.logout()}><LogOut size={17} aria-hidden="true" />Log out</button>
            </>
          ) : session.status === 'anonymous' ? (
            <Link className="button button--primary button--sm" to="/login">Sign in</Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
