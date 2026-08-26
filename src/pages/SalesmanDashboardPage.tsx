import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';

interface DashboardModule {
  id: string;
  code: string;
  title: string;
  description: string;
  status: 'Active' | 'Coming Soon';
  route?: string;
  buttonLabel?: string;
  iconSvg: React.ReactNode;
}

const SALESMAN_MODULES: DashboardModule[] = [
  {
    id: 'billing',
    code: 'POS-01',
    title: 'Billing Terminal',
    description: 'Fast POS billing interface with Cash/UPI payment and receipt generation.',
    status: 'Active',
    route: '/billing',
    buttonLabel: 'Open Billing Terminal →',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'bill-history',
    code: 'HST-02',
    title: 'Bill History',
    description: 'Review previous customer invoices and verify completed transactions.',
    status: 'Coming Soon',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export const SalesmanDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div className="welcome-tag">SALES COUNTER TERMINAL</div>
        <h2 className="dashboard-title">Point of Sale Workspace</h2>
        <p className="dashboard-subtitle">
          Logged in as <strong>{user?.username}</strong>. Select a module below to proceed with counter billing.
        </p>
      </div>

      <div className="module-grid">
        {SALESMAN_MODULES.map((module) => (
          <div
            key={module.id}
            className={`module-card ${module.route ? 'module-card-interactive' : ''}`}
            onClick={() => {
              if (module.route) navigate(module.route);
            }}
          >
            <div className="module-card-header">
              <div className={`module-icon-box ${module.status === 'Active' ? 'module-icon-active' : ''}`}>
                {module.iconSvg}
              </div>
              <span className={`badge ${module.status === 'Active' ? 'badge-active' : 'badge-subtle'}`}>
                {module.status}
              </span>
            </div>
            <div className="module-card-body">
              <div className="module-code">{module.code}</div>
              <h3 className="module-title">{module.title}</h3>
              <p className="module-description">{module.description}</p>
            </div>
            <div className="module-card-footer">
              {module.route ? (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(module.route!);
                  }}
                >
                  {module.buttonLabel || 'Open Module →'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  disabled
                  title="Module will be available in subsequent phase"
                >
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
