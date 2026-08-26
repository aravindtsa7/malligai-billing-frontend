import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { billingApi } from '../api/billing.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import { formatDisplayCurrency } from '../utils/decimal.ts';
import type {
  SerializedBill,
  BillPagination,
  RateType,
  PaymentType,
  BillStatus,
} from '../types/billing.types.ts';

export const BillHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bills, setBills] = useState<SerializedBill[]>([]);
  const [pagination, setPagination] = useState<BillPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'ALL'>('ALL');
  const [rateTypeFilter, setRateTypeFilter] = useState<RateType | 'ALL'>('ALL');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentType | 'ALL'>('ALL');
  const [pageLimit, setPageLimit] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Active request ref to avoid race conditions
  const activeRequestIdRef = useRef<number>(0);

  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/salesman';

  useEffect(() => {
    let isMounted = true;
    const requestId = ++activeRequestIdRef.current;

    const fetchBills = async () => {
      try {
        const queryParams: {
          page: number;
          limit: number;
          status?: BillStatus;
          rateType?: RateType;
          paymentType?: PaymentType;
        } = {
          page: currentPage,
          limit: pageLimit,
        };

        if (statusFilter !== 'ALL') {
          queryParams.status = statusFilter;
        }
        if (rateTypeFilter !== 'ALL') {
          queryParams.rateType = rateTypeFilter;
        }
        if (paymentTypeFilter !== 'ALL') {
          queryParams.paymentType = paymentTypeFilter;
        }

        const result = await billingApi.listBills(queryParams);

        if (isMounted && requestId === activeRequestIdRef.current) {
          setBills(result.bills);
          setPagination(result.pagination);
        }
      } catch (err: unknown) {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setError(getApiErrorMessage(err, 'Failed to load bill history.'));
        }
      } finally {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchBills();

    return () => {
      isMounted = false;
    };
  }, [statusFilter, rateTypeFilter, paymentTypeFilter, currentPage, pageLimit]);

  const handleRefresh = async () => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const queryParams: {
        page: number;
        limit: number;
        status?: BillStatus;
        rateType?: RateType;
        paymentType?: PaymentType;
      } = {
        page: currentPage,
        limit: pageLimit,
      };

      if (statusFilter !== 'ALL') {
        queryParams.status = statusFilter;
      }
      if (rateTypeFilter !== 'ALL') {
        queryParams.rateType = rateTypeFilter;
      }
      if (paymentTypeFilter !== 'ALL') {
        queryParams.paymentType = paymentTypeFilter;
      }

      const result = await billingApi.listBills(queryParams);

      if (requestId === activeRequestIdRef.current) {
        setBills(result.bills);
        setPagination(result.pagination);
      }
    } catch (err: unknown) {
      if (requestId === activeRequestIdRef.current) {
        setError(getApiErrorMessage(err, 'Failed to load bill history.'));
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleStatusFilterChange = (val: BillStatus | 'ALL') => {
    setLoading(true);
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleRateTypeFilterChange = (val: RateType | 'ALL') => {
    setLoading(true);
    setRateTypeFilter(val);
    setCurrentPage(1);
  };

  const handlePaymentTypeFilterChange = (val: PaymentType | 'ALL') => {
    setLoading(true);
    setPaymentTypeFilter(val);
    setCurrentPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLoading(true);
    setPageLimit(newLimit);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setLoading(true);
    setStatusFilter('ALL');
    setRateTypeFilter('ALL');
    setPaymentTypeFilter('ALL');
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== currentPage) {
      setLoading(true);
      setCurrentPage(newPage);
    }
  };

  const hasActiveFilters =
    statusFilter !== 'ALL' || rateTypeFilter !== 'ALL' || paymentTypeFilter !== 'ALL';

  return (
    <div className="bill-history-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to={homeRoute} className="breadcrumb-link">
              {user?.role === 'ADMIN' ? 'Admin' : 'POS Counter'}
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Bill History</span>
          </div>
          <h2 className="page-title">Bill History</h2>
          <span className="page-subtitle">
            Authoritative sales invoice register, customer transactions, and audit records
          </span>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/billing')}
            title="Open Billing Terminal"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Billing Terminal
          </button>
          <button
            type="button"
            className="btn btn-outline btn-refresh"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh bill records"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleRefresh}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="history-filter-card">
        <div className="history-filters-row">
          {/* Status Filter */}
          <div className="history-filter-item">
            <label className="history-filter-label">Status:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Status Filter">
              {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`pill-btn ${statusFilter === st ? 'pill-btn-active' : ''}`}
                  onClick={() => handleStatusFilterChange(st)}
                  role="radio"
                  aria-checked={statusFilter === st}
                >
                  {st === 'ALL' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Rate Type Filter */}
          <div className="history-filter-item">
            <label className="history-filter-label">Rate Type:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Rate Type Filter">
              {(['ALL', 'NORMAL', 'RETAIL', 'FUNCTION'] as const).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  className={`pill-btn ${rateTypeFilter === rt ? 'pill-btn-active pill-btn-rate' : ''}`}
                  onClick={() => handleRateTypeFilterChange(rt)}
                  role="radio"
                  aria-checked={rateTypeFilter === rt}
                >
                  {rt === 'ALL' ? 'All' : rt}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Type Filter */}
          <div className="history-filter-item">
            <label className="history-filter-label">Payment:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Payment Type Filter">
              {(['ALL', 'CASH', 'UPI'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={`pill-btn ${paymentTypeFilter === pt ? 'pill-btn-active pill-btn-payment' : ''}`}
                  onClick={() => handlePaymentTypeFilterChange(pt)}
                  role="radio"
                  aria-checked={paymentTypeFilter === pt}
                >
                  {pt === 'ALL' ? 'All' : pt}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Filters & Page Limit */}
          <div className="history-filter-actions">
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={handleResetFilters}
                title="Reset all filters"
              >
                Clear Filters
              </button>
            )}
            <div className="page-limit-selector">
              <label htmlFor="page-limit-select" className="history-filter-label">
                Show:
              </label>
              <select
                id="page-limit-select"
                className="form-select form-select-sm"
                value={pageLimit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bill History Table Section */}
      <div className="data-table-container">
        {loading ? (
          <div className="table-loading-state">
            <div className="auth-spinner"></div>
            <p>Loading bill history records...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-icon-box" aria-hidden="true">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3>No bill records found</h3>
            {hasActiveFilters ? (
              <p>
                No bills matched the selected filter criteria.{' '}
                <button type="button" className="link-button" onClick={handleResetFilters}>
                  Clear filters
                </button>
                .
              </p>
            ) : (
              <p>
                No bills have been generated yet.{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate('/billing')}
                >
                  Create First Bill
                </button>
              </p>
            )}
          </div>
        ) : (
          <table className="data-table history-data-table">
            <thead>
              <tr>
                <th className="th-bill-no">Bill Number</th>
                <th className="th-date">Date & Time</th>
                <th className="th-creator">Created By</th>
                <th className="th-rate-type text-center">Rate Type</th>
                <th className="th-payment text-center">Payment</th>
                <th className="th-amount text-right">Total Amount</th>
                <th className="th-status text-center">Status</th>
                <th className="th-action text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const isCancelled = bill.status === 'CANCELLED';
                return (
                  <tr
                    key={bill.id}
                    className={`history-row ${isCancelled ? 'history-row-cancelled' : ''}`}
                    onClick={() => navigate(`/bills/${bill.id}`)}
                  >
                    <td className="td-bill-no">
                      <Link
                        to={`/bills/${bill.id}`}
                        className="bill-number-link font-mono font-semibold"
                        onClick={(e) => e.stopPropagation()}
                        title="View bill details"
                      >
                        {bill.billNumber}
                      </Link>
                    </td>
                    <td className="td-date font-mono text-muted">
                      {new Date(bill.createdAt).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </td>
                    <td className="td-creator">
                      <div className="bill-creator-box">
                        <span className="creator-name font-medium">
                          {bill.creator?.username || `User #${bill.createdBy}`}
                        </span>
                        {bill.creator?.role && (
                          <span
                            className={`badge ${bill.creator.role === 'ADMIN' ? 'role-admin' : 'role-salesman'}`}
                          >
                            {bill.creator.role}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td-rate-type text-center">
                      <span className="badge badge-active">{bill.rateType}</span>
                    </td>
                    <td className="td-payment text-center">
                      <span
                        className={`badge ${bill.paymentType === 'CASH' ? 'role-admin' : 'role-salesman'}`}
                      >
                        {bill.paymentType}
                      </span>
                    </td>
                    <td className="td-amount text-right font-mono font-bold">
                      {formatDisplayCurrency(bill.totalAmount)}
                    </td>
                    <td className="td-status text-center">
                      {isCancelled ? (
                        <span className="status-badge status-cancelled">
                          CANCELLED
                        </span>
                      ) : (
                        <span className="status-badge status-active">
                          COMPLETED
                        </span>
                      )}
                    </td>
                    <td className="td-action text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => navigate(`/bills/${bill.id}`)}
                        title={`View invoice details for ${bill.billNumber}`}
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && bills.length > 0 && (
        <div className="pagination-bar">
          <div className="pagination-info">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            <strong>{pagination.total}</strong> {pagination.total === 1 ? 'bill' : 'bills'}
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              title="Previous page"
            >
              ← Previous
            </button>

            <span className="pagination-current-page">
              Page <strong>{pagination.page}</strong> of{' '}
              <strong>{pagination.totalPages}</strong>
            </span>

            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              title="Next page"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillHistoryPage;
