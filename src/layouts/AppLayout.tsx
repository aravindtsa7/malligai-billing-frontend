import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  matchPrefixes?: string[];
  exact?: boolean;
}

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Desktop sidebar collapse state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('malligai_sidebar_collapsed') === 'true';
  });

  // Mobile sidebar drawer state
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('malligai_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleMobile = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isAdmin = user?.role === 'ADMIN';
  const homeRoute = isAdmin ? '/admin' : '/salesman';

  // Navigation Items by Role
  const adminNavItems: NavItem[] = [
    {
      to: '/admin',
      label: 'Dashboard',
      exact: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      to: '/billing',
      label: 'Create Bill',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      to: '/bills',
      label: 'Bills',
      matchPrefixes: ['/bills'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      to: '/admin/products',
      label: 'Products',
      matchPrefixes: ['/admin/products', '/admin/categories'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      to: '/admin/stock',
      label: 'Stock Management',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      to: '/admin/salesmen',
      label: 'Salesmen',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: '/admin/receipt-settings',
      label: 'Receipt Settings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="16" y2="16" />
          <line x1="8" y1="8" x2="10" y2="8" />
        </svg>
      ),
    },
    {
      to: '/admin/label-printing',
      label: 'Label Printing',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M7 11h10" />
          <path d="M7 15h6" />
        </svg>
      ),
    },
  ];

  const salesmanNavItems: NavItem[] = [
    {
      to: '/salesman',
      label: 'Dashboard',
      exact: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      to: '/billing',
      label: 'Create Bill',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      to: '/bills',
      label: 'Bills',
      matchPrefixes: ['/bills'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ];

  const currentNavItems = isAdmin ? adminNavItems : salesmanNavItems;

  // Resolve current active page title for top bar
  const getPageTitle = (): string => {
    const path = location.pathname;
    if (path === '/admin' || path === '/salesman') return 'Dashboard';
    if (path === '/billing') return 'Billing Terminal';
    if (path.startsWith('/bills')) return 'Bill History';
    if (path.startsWith('/admin/categories')) return 'Category Master';
    if (path.startsWith('/admin/products')) return 'Product Management';
    if (path.startsWith('/admin/stock')) return 'Stock Management';
    if (path.startsWith('/admin/salesmen')) return 'Salesman Management';
    if (path.startsWith('/admin/receipt-settings')) return 'Receipt Settings';
    if (path.startsWith('/admin/label-printing')) return 'Label Printing';
    return 'Malligai POS';
  };

  const isItemActive = (item: NavItem): boolean => {
    if (item.exact) {
      return location.pathname === item.to;
    }
    if (item.matchPrefixes) {
      return item.matchPrefixes.some((p) => location.pathname.startsWith(p));
    }
    return location.pathname.startsWith(item.to);
  };

  return (
    <div className="app-shell">
      {/* Left Sidebar */}
      <aside
        className={`app-sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          <Link
            to={homeRoute}
            className="sidebar-brand-link"
            title="Malligai Billing Dashboard"
            onClick={() => setIsMobileOpen(false)}
          >
            <img
              src="/images/malligai-logo.png"
              alt="Malligai Billing"
              className="sidebar-full-logo"
            />
            <img
              src="/images/malligai-logo-mark.png"
              alt="Malligai"
              className="sidebar-mark-logo"
            />
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          {currentNavItems.map((item) => {
            const active = isItemActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                title={item.label}
                onClick={() => setIsMobileOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user-info">
              <div className="user-avatar-circle" title={user.username}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-meta-text">
                <span className="user-meta-name" title={user.username}>
                  {user.username}
                </span>
                <span className={`role-badge role-${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              </div>
            </div>
          )}
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            title="Log Out of Application"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Area */}
      <div className="app-main-layout">
        {/* Top Bar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn-sidebar-toggle"
              onClick={() => {
                if (window.innerWidth <= 900) {
                  handleToggleMobile();
                } else {
                  handleToggleCollapse();
                }
              }}
              title="Toggle Sidebar Navigation"
              aria-label="Toggle Sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="topbar-page-context">
              <span className="topbar-brand-tag">MALLIGAI POS</span>
              <span className="text-muted" style={{ fontSize: '13px' }}>/</span>
              <h2 className="topbar-page-title">{getPageTitle()}</h2>
            </div>
          </div>

          <div className="topbar-right">
            {user && (
              <div className="topbar-user-badge">
                <span className="topbar-user-name">{user.username}</span>
                <span className={`role-badge role-${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-outline btn-topbar-logout"
              onClick={handleLogout}
              title="Log Out"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="app-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
