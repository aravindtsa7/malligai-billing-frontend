import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { billingApi } from '../api/billing.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { SerializedBill, BillPagination } from '../types/billing.types.ts';
import {
  formatDisplayCurrency,
  getLocalDayBoundaryIsoRange,
  sumAmounts,
} from '../utils/decimal.ts';

// Helper to fetch all pages for today's bounded query to remove 100-bill ceiling
const fetchAllTodayCompletedBills = async (startDate: string, endDate: string): Promise<SerializedBill[]> => {
  const page1Result = await billingApi.listBills({
    startDate,
    endDate,
    status: 'COMPLETED',
    page: 1,
    limit: 100,
  });

  const allTodayBills: SerializedBill[] = [...page1Result.bills];
  const totalPages = page1Result.pagination?.totalPages || 1;

  if (totalPages > 1) {
    const pageRequests: Promise<{ bills: SerializedBill[]; pagination: BillPagination }>[] = [];
    for (let p = 2; p <= totalPages; p++) {
      pageRequests.push(
        billingApi.listBills({
          startDate,
          endDate,
          status: 'COMPLETED',
          page: p,
          limit: 100,
        })
      );
    }
    const additionalResults = await Promise.all(pageRequests);
    for (const res of additionalResults) {
      if (res?.bills && Array.isArray(res.bills)) {
        allTodayBills.push(...res.bills);
      }
    }
  }

  return allTodayBills;
};

export const SalesmanDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState<string>('0.00');
  const [todayBillsCount, setTodayBillsCount] = useState<number>(0);
  const [recentBills, setRecentBills] = useState<SerializedBill[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { startDate, endDate } = getLocalDayBoundaryIsoRange();

      const [recentBillsResult, todayBills] = await Promise.all([
        billingApi.listBills({ page: 1, limit: 5 }),
        fetchAllTodayCompletedBills(startDate, endDate),
      ]);

      setRecentBills(recentBillsResult.bills);

      const todayCompleted = todayBills.filter((b) => b.status === 'COMPLETED');
      setTodayBillsCount(todayCompleted.length);
      if (todayCompleted.length > 0) {
        const total = sumAmounts(todayCompleted.map((b) => b.totalAmount));
        setTodaySales(total);
      } else {
        setTodaySales('0.00');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load counter metrics.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const runInitialFetch = async () => {
      try {
        const { startDate, endDate } = getLocalDayBoundaryIsoRange();

        const [recentBillsResult, todayBills] = await Promise.all([
          billingApi.listBills({ page: 1, limit: 5 }),
          fetchAllTodayCompletedBills(startDate, endDate),
        ]);

        if (!isMounted) return;

        setRecentBills(recentBillsResult.bills);

        const todayCompleted = todayBills.filter((b) => b.status === 'COMPLETED');
        setTodayBillsCount(todayCompleted.length);
        if (todayCompleted.length > 0) {
          const total = sumAmounts(todayCompleted.map((b) => b.totalAmount));
          setTodaySales(total);
        } else {
          setTodaySales('0.00');
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(getApiErrorMessage(err, 'Failed to load counter metrics.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    runInitialFetch();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    await loadData();
  };

  const formatBillTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="dashboard-page-container">
      {/* Decorative Subtle Malligai Artwork */}
      <div className="dashboard-bg-artwork" aria-hidden="true" />

      <div className="dashboard-content-layer">
        {/* Hero Header */}
        <header className="dashboard-hero-header">
          <div>
            <div className="hero-welcome-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Point of Sale Terminal</span>
            </div>
            <h1 className="hero-welcome-title">
              Welcome, {user?.username || 'Cashier'}
            </h1>
            <p className="hero-welcome-desc">
              Sales counter terminal is ready. Create customer invoices and review sales records.
            </p>
          </div>

          <div className="dashboard-actions-header">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh Metrics"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/billing')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Start Billing</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleRefresh}
              style={{ marginLeft: 'auto' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Counter Summary Cards */}
        <section className="dashboard-stats-grid" aria-label="Counter Summary Metrics" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {/* 1. Today's Counter Sales */}
          <div className="dashboard-stat-card">
            <div className="stat-card-info">
              <span className="stat-card-label">Today's Sales</span>
              <span className="stat-card-value">
                {loading ? '...' : formatDisplayCurrency(todaySales)}
              </span>
              <span className="stat-card-subtext">Total counter collections</span>
            </div>
            <div className="stat-card-icon success-tone" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>

          {/* 2. Bills Generated Today */}
          <div className="dashboard-stat-card">
            <div className="stat-card-info">
              <span className="stat-card-label">Bills Today</span>
              <span className="stat-card-value">
                {loading ? '...' : todayBillsCount}
              </span>
              <span className="stat-card-subtext">Completed customer invoices</span>
            </div>
            <div className="stat-card-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="dashboard-quick-actions" aria-label="Quick Actions">
          <div className="section-title-row">
            <h2 className="section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#b8860b' }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Counter Actions</span>
            </h2>
          </div>

          <div className="quick-actions-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <button
              type="button"
              className="quick-action-btn"
              onClick={() => navigate('/billing')}
            >
              <div className="quick-action-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <span className="quick-action-label">Open Billing Terminal (POS)</span>
              <span className="quick-action-arrow" aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              className="quick-action-btn"
              onClick={() => navigate('/bills')}
            >
              <div className="quick-action-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <span className="quick-action-label">View Bill History</span>
              <span className="quick-action-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* Recent Bills Card */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#b8860b' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Recent Counter Bills</span>
            </h2>
            <Link to="/bills" className="view-all-link">
              <span>View All Bills</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {loading ? (
            <div className="empty-state-box">
              <p>Loading recent bills...</p>
            </div>
          ) : recentBills.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-state-icon" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                </svg>
              </div>
              <span className="empty-state-title">No bills recorded yet</span>
              <span className="empty-state-desc">Bills created at your terminal will appear here.</span>
            </div>
          ) : (
            <div className="recent-bills-table-container">
              <table className="recent-bills-table" aria-label="Recent Bills Table">
                <thead>
                  <tr>
                    <th>Bill No</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBills.map((bill) => (
                    <tr key={bill.id}>
                      <td className="bill-num-cell">#{bill.billNumber}</td>
                      <td className="amount-cell">{formatDisplayCurrency(bill.totalAmount)}</td>
                      <td>
                        <span className={`badge ${bill.paymentType === 'UPI' ? 'badge-info' : 'badge-subtle'}`}>
                          {bill.paymentType}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${bill.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="text-muted font-mono" style={{ fontSize: '12px' }}>
                        {formatBillTime(bill.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-view-bill"
                          onClick={() => navigate(`/bills/${bill.id}`)}
                          title={`View Bill #${bill.billNumber}`}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesmanDashboardPage;
