import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <h1 className="brand-title">Malligai Billing</h1>
          <span className="brand-subtitle">Shop Management System</span>
        </div>
        <div className="header-user-section">
          {user && (
            <div className="user-info">
              <span className="user-name">👤 {user.username}</span>
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
