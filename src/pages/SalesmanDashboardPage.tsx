import React from 'react';
import { useAuth } from '../auth/useAuth.ts';

interface DashboardModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'Ready in Phase 2' | 'Coming Soon';
}

const SALESMAN_MODULES: DashboardModule[] = [
  {
    id: 'billing',
    title: 'Billing Terminal',
    description: 'Fast POS billing interface with Cash/UPI payment and receipt generation.',
    icon: '🧾',
    status: 'Coming Soon',
  },
  {
    id: 'bill-history',
    title: 'Bill History',
    description: 'Review previous customer invoices and verify completed transactions.',
    icon: '📜',
    status: 'Coming Soon',
  },
];

export const SalesmanDashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <h2 className="dashboard-title">Salesman Terminal</h2>
        <p className="dashboard-subtitle">
          Welcome back, <strong>{user?.username}</strong>. Select a module below.
        </p>
      </div>

      <div className="module-grid">
        {SALESMAN_MODULES.map((module) => (
          <div key={module.id} className="module-card">
            <div className="module-card-header">
              <span className="module-icon">{module.icon}</span>
              <span className="badge badge-subtle">{module.status}</span>
            </div>
            <h3 className="module-title">{module.title}</h3>
            <p className="module-description">{module.description}</p>
            <div className="module-card-footer">
              <button
                type="button"
                className="btn btn-outline btn-block"
                disabled
                title="Module will be available in subsequent phase"
              >
                Open Module (Phase 1 Placeholder)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
