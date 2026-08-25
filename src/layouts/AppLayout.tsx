import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/salesman';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <Link to={homeRoute} className="header-brand-link" title="Return to Dashboard">
            <div className="brand-badge">MB</div>
            <div className="header-brand-text">
              <h1 className="brand-title">Malligai Billing</h1>
              <span className="brand-subtitle">POS & Inventory System</span>
            </div>
          </Link>
        </div>

        <div className="header-user-section">
          {user && (
            <div className="user-info">
              <span className="user-icon-avatar" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="user-name">{user.username}</span>
              <span className={`role-badge role-${user.role.toLowerCase()}`}>
                {user.role}
              </span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-logout"
            onClick={handleLogout}
            title="Log out of application"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};
