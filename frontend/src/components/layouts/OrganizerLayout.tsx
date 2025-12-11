import { NavLink, Outlet } from 'react-router-dom';

export function OrganizerLayout() {
  return (
    <div className="layout-organizer">
      <aside className="layout-organizer-sidebar">
        <div className="sidebar-title">Organizer</div>
        <nav className="sidebar-nav">
          <NavLink
            to="/organizer"
            end
            className={({ isActive }) =>
              isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
            }
          >
            Activities
          </NavLink>
          <div className="sidebar-link sidebar-link-disabled">Analytics (soon)</div>
          <div className="sidebar-link sidebar-link-disabled">Settings (soon)</div>
        </nav>
      </aside>
      <section className="layout-organizer-content">
        <Outlet />
      </section>
    </div>
  );
}

