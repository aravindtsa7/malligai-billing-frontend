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

const ADMIN_MODULES: DashboardModule[] = [
  {
    id: 'categories',
    code: 'CAT-01',
    title: 'Category Master',
    description: 'Manage product taxonomy, Tamil naming, display ordering, and category status.',
    status: 'Active',
    route: '/admin/categories',
    buttonLabel: 'Manage Categories →',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'products',
    code: 'PRD-02',
    title: 'Products Management',
    description: 'Manage shop products, barcodes, category assignments, and retail/function pricing.',
    status: 'Active',
    route: '/admin/products',
    buttonLabel: 'Manage Products →',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'billing',
    code: 'POS-03',
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
    id: 'stock',
    code: 'STK-04',
    title: 'Stock Management',
    description: 'Track inventory, record stock-in, and manage stock adjustment logs.',
    status: 'Active',
    route: '/admin/stock',
    buttonLabel: 'Manage Stock →',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'bill-history',
    code: 'HST-05',
    title: 'Bill History',
    description: 'View sales invoices, inspect items snapshots, and perform bill cancellations.',
    status: 'Active',
    route: '/bills',
    buttonLabel: 'View Bill History →',
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
  {
    id: 'salesmen',
    code: 'USR-06',
    title: 'Salesmen & Users',
    description: 'Manage staff accounts, assign roles, and control terminal access permissions.',
    status: 'Coming Soon',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div className="welcome-tag">ADMINISTRATOR WORKSPACE</div>
        <h2 className="dashboard-title">System Control Center</h2>
        <p className="dashboard-subtitle">
          Logged in as <strong>{user?.username}</strong>. Select a module below to proceed with operations.
        </p>
      </div>

      <div className="module-grid">
        {ADMIN_MODULES.map((module) => (
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
