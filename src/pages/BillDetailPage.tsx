import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { billingApi } from '../api/billing.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import { formatDisplayCurrency } from '../utils/decimal.ts';
import type { SerializedBill } from '../types/billing.types.ts';
import { PrintableReceipt, type PaperSize } from '../components/PrintableReceipt.tsx';

export const BillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bill, setBill] = useState<SerializedBill | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cancellation modal & submission state
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Thermal Receipt Paper Size State
  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    const saved = localStorage.getItem('malligai_receipt_paper_size');
    return saved === '58mm' ? '58mm' : '80mm';
  });

  const handlePaperSizeChange = (size: PaperSize) => {
    setPaperSize(size);
    localStorage.setItem('malligai_receipt_paper_size', size);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/salesman';
  const isAdmin = user?.role === 'ADMIN';

  const billIdNum = id ? parseInt(id, 10) : NaN;

  const loadBill = useCallback(async () => {
    if (isNaN(billIdNum) || billIdNum <= 0) {
      setError('Invalid bill ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await billingApi.getBillById(billIdNum);
      setBill(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load bill details.'));
    } finally {
      setLoading(false);
    }
  }, [billIdNum]);

  useEffect(() => {
    let isMounted = true;

    const fetchBill = async () => {
      if (isNaN(billIdNum) || billIdNum <= 0) {
        if (isMounted) {
          setError('Invalid bill ID');
          setLoading(false);
        }
        return;
      }

      try {
        const data = await billingApi.getBillById(billIdNum);
        if (isMounted) {
          setBill(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(getApiErrorMessage(err, 'Failed to load bill details.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBill();

    return () => {
      isMounted = false;
    };
  }, [billIdNum]);

  const handleCloseCancelModal = useCallback(() => {
    if (isCancelling) return;
    setShowCancelModal(false);
    setCancelError(null);
  }, [isCancelling]);

  // Handle Cancel Bill Modal Open/Close
  const handleOpenCancelModal = () => {
    if (!isAdmin || bill?.status !== 'COMPLETED' || isCancelling) return;
    setCancelError(null);
    setShowCancelModal(true);
  };

  // Keyboard Escape listener for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCancelModal && !isCancelling) {
        handleCloseCancelModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCancelModal, isCancelling, handleCloseCancelModal]);

  // Submit Bill Cancellation
  const handleConfirmCancel = async () => {
    if (!isAdmin || !bill || bill.status !== 'COMPLETED' || isCancelling) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      const updatedBill = await billingApi.cancelBill(bill.id);
      // Use authoritative cancelled bill returned by backend
      setBill(updatedBill);
      setShowCancelModal(false);
      setSuccessMessage(
        `Bill #${bill.billNumber} has been cancelled successfully. Sold quantities have been restored to current inventory stock.`
      );
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err, 'Failed to cancel bill.');
      setCancelError(errMsg);

      // If already cancelled or conflict (409), reload bill to sync authoritative state
      if (errMsg.toLowerCase().includes('already cancelled') || errMsg.toLowerCase().includes('conflict')) {
        loadBill();
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="bill-detail-page">
      {/* Breadcrumb Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to={homeRoute} className="breadcrumb-link">
              {isAdmin ? 'Admin' : 'POS Counter'}
            </Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/bills" className="breadcrumb-link">
              Bill History
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">
              {bill ? bill.billNumber : `Bill #${id || '—'}`}
            </span>
          </div>
          <h2 className="page-title">
            {bill ? `Invoice ${bill.billNumber}` : 'Bill Detail'}
          </h2>
          <span className="page-subtitle">
            Authoritative transaction snapshot and immutable line item records
          </span>
        </div>

        <div className="page-header-actions">
          {bill && (
            <div className="receipt-paper-size-picker">
              <span className="paper-size-label">Paper:</span>
              <div className="paper-size-buttons" role="radiogroup" aria-label="Receipt Paper Width">
                <button
                  type="button"
                  className={`btn-paper-size ${paperSize === '80mm' ? 'btn-paper-size-active' : ''}`}
                  onClick={() => handlePaperSizeChange('80mm')}
                  role="radio"
                  aria-checked={paperSize === '80mm'}
                  title="80mm Standard thermal receipt"
                >
                  80mm
                </button>
                <button
                  type="button"
                  className={`btn-paper-size ${paperSize === '58mm' ? 'btn-paper-size-active' : ''}`}
                  onClick={() => handlePaperSizeChange('58mm')}
                  role="radio"
                  aria-checked={paperSize === '58mm'}
                  title="58mm Compact thermal receipt"
                >
                  58mm
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-print-receipt"
            onClick={handlePrintReceipt}
            disabled={loading || !bill || isCancelling}
            title="Print authoritative receipt snapshot"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Receipt
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/bills')}
            title="Return to Bill History register"
          >
            ← Bill History
          </button>
          <button
            type="button"
            className="btn btn-outline btn-refresh"
            onClick={loadBill}
            disabled={loading || isCancelling}
            title="Refresh bill data"
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

      {/* Notifications */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible">
          <div className="alert-content-with-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setSuccessMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={loadBill}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="table-loading-state">
          <div className="auth-spinner"></div>
          <p>Loading invoice records...</p>
        </div>
      ) : !bill ? (
        <div className="table-empty-state">
          <p>Bill not found or could not be loaded.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/bills')}
          >
            Back to Bill History
          </button>
        </div>
      ) : (
        <div className="bill-detail-container">
          {/* Cancellation Banner if CANCELLED */}
          {bill.status === 'CANCELLED' && (
            <div className="cancelled-bill-banner">
              <div className="cancelled-banner-icon" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div className="cancelled-banner-content">
                <h4 className="cancelled-banner-title">THIS BILL HAS BEEN CANCELLED</h4>
                <p className="cancelled-banner-desc">
                  This transaction is voided. Sold quantities were restored to inventory stock on{' '}
                  <strong>
                    {bill.cancelledAt
                      ? new Date(bill.cancelledAt).toLocaleString('en-IN')
                      : 'record'}
                  </strong>
                  {bill.canceller && (
                    <span>
                      {' '}
                      by <strong>{bill.canceller.username}</strong> ({bill.canceller.role})
                    </span>
                  )}
                  . Historical bill items remain preserved for audit compliance.
                </p>
              </div>
            </div>
          )}

          {/* Bill Meta Summary Grid */}
          <div className="bill-meta-card">
            <div className="bill-meta-header-row">
              <div>
                <span className="bill-meta-badge">INVOICE SUMMARY</span>
                <h3 className="bill-meta-bill-number font-mono">{bill.billNumber}</h3>
              </div>

              <div className="bill-meta-status-box">
                {bill.status === 'COMPLETED' ? (
                  <span className="status-badge status-active">
                    COMPLETED
                  </span>
                ) : (
                  <span className="status-badge status-cancelled">
                    CANCELLED
                  </span>
                )}
              </div>
            </div>

            <div className="bill-meta-grid">
              <div className="bill-meta-item">
                <span className="meta-label">Billed Date & Time</span>
                <span className="meta-value font-mono">
                  {new Date(bill.createdAt).toLocaleString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>

              <div className="bill-meta-item">
                <span className="meta-label">Billed By (Cashier)</span>
                <span className="meta-value">
                  <strong>{bill.creator?.username || `User #${bill.createdBy}`}</strong>
                  {bill.creator?.role && (
                    <span
                      className={`badge ${bill.creator.role === 'ADMIN' ? 'role-admin' : 'role-salesman'}`}
                      style={{ marginLeft: 8 }}
                    >
                      {bill.creator.role}
                    </span>
                  )}
                </span>
              </div>

              <div className="bill-meta-item">
                <span className="meta-label">Rate Applied</span>
                <span className="meta-value">
                  <span className="badge badge-active">{bill.rateType}</span>
                </span>
              </div>

              <div className="bill-meta-item">
                <span className="meta-label">Payment Method</span>
                <span className="meta-value">
                  <span
                    className={`badge ${bill.paymentType === 'CASH' ? 'role-admin' : 'role-salesman'}`}
                  >
                    {bill.paymentType}
                  </span>
                </span>
              </div>

              {bill.status === 'CANCELLED' && (
                <>
                  <div className="bill-meta-item">
                    <span className="meta-label">Cancelled Date</span>
                    <span className="meta-value font-mono text-danger">
                      {bill.cancelledAt
                        ? new Date(bill.cancelledAt).toLocaleString('en-IN')
                        : '—'}
                    </span>
                  </div>

                  <div className="bill-meta-item">
                    <span className="meta-label">Cancelled By</span>
                    <span className="meta-value">
                      <strong>{bill.canceller?.username || `User #${bill.cancelledBy}`}</strong>
                      {bill.canceller?.role && (
                        <span className="badge role-admin" style={{ marginLeft: 8 }}>
                          {bill.canceller.role}
                        </span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Historical Snapshot Items Table */}
          <div className="bill-items-card">
            <div className="bill-items-header">
              <h3 className="bill-items-title">Purchased Items Snapshot</h3>
              <span className="items-count-pill">
                {bill.items?.length || 0} {bill.items?.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="bill-items-table-wrapper">
              <table className="data-table bill-items-table">
                <thead>
                  <tr>
                    <th className="th-item-sno">#</th>
                    <th className="th-item-code">Product Code</th>
                    <th className="th-item-name">Product Name</th>
                    <th className="th-item-unit">Unit</th>
                    <th className="th-item-qty text-center">Quantity</th>
                    <th className="th-item-rate-type text-center">Rate Type</th>
                    <th className="th-item-rate text-right">Unit Rate</th>
                    <th className="th-item-amount text-right">Line Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.items && bill.items.length > 0 ? (
                    bill.items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="td-item-sno font-mono text-muted">{idx + 1}</td>
                        <td className="td-item-code font-mono font-semibold">
                          {item.productCode}
                        </td>
                        <td className="td-item-name font-medium">{item.productName}</td>
                        <td className="td-item-unit">
                          <span className="unit-badge">{item.unit}</span>
                        </td>
                        <td className="td-item-qty text-center font-mono font-semibold">
                          {item.quantity} <span className="stock-unit">{item.unit}</span>
                        </td>
                        <td className="td-item-rate-type text-center">
                          <span className="badge badge-subtle">{item.rateType}</span>
                        </td>
                        <td className="td-item-rate text-right font-mono">₹{item.rate}</td>
                        <td className="td-item-amount text-right font-mono font-bold">
                          ₹{item.amount}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center text-muted" style={{ padding: 24 }}>
                        No items snapshot found for this bill.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Box */}
            <div className="bill-financial-summary">
              <div className="financial-totals-box">
                <div className="financial-row">
                  <span className="fin-label">Subtotal:</span>
                  <span className="fin-val font-mono">₹{bill.subtotal}</span>
                </div>
                <div className="financial-row financial-grand-total-row">
                  <span className="fin-grand-label">Total Amount:</span>
                  <span className="fin-grand-val font-mono font-bold">
                    {formatDisplayCurrency(bill.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Cancellation Action Bar */}
          {isAdmin && bill.status === 'COMPLETED' && (
            <div className="admin-cancel-action-bar">
              <div className="cancel-action-info">
                <strong className="cancel-action-title">Administrator Actions</strong>
                <span className="cancel-action-subtitle">
                  Void this completed invoice and automatically restore sold stock to inventory.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleOpenCancelModal}
                disabled={isCancelling}
                title="Cancel entire bill and restore stock"
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Cancel Bill
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for ADMIN Cancellation */}
      {showCancelModal && bill && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-cancel-dialog">
            <div className="modal-header modal-cancel-header">
              <div className="cancel-modal-title-box">
                <div className="cancel-modal-warn-icon" aria-hidden="true">
                  ⚠️
                </div>
                <div>
                  <h3 className="modal-title">Confirm Bill Cancellation</h3>
                  <span className="cancel-modal-subtitle font-mono">
                    Bill #{bill.billNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body modal-cancel-body">
              {cancelError && (
                <div className="alert alert-error">
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="cancel-warning-box">
                <p className="cancel-warning-text">
                  Please review the cancellation implications carefully before confirming:
                </p>
                <ul className="cancel-warning-list">
                  <li>
                    <strong>Entire Bill Cancellation:</strong> The full invoice amount of{' '}
                    <strong>{formatDisplayCurrency(bill.totalAmount)}</strong> will be voided.
                  </li>
                  <li>
                    <strong>Automatic Stock Restoration:</strong> All sold item quantities will be
                    atomically restored to the current inventory by the backend system.
                  </li>
                  <li>
                    <strong>Immutable Audit Trail:</strong> The historical bill, item snapshots, and a
                    corresponding <code>SALE_CANCEL</code> ledger entry will remain permanently
                    preserved.
                  </li>
                  <li>
                    <strong>Irreversible:</strong> This cancellation cannot be undone or performed
                    twice.
                  </li>
                </ul>
              </div>
            </div>

            <div className="modal-footer modal-cancel-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
              >
                Keep Bill Active
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <span className="btn-spinner" />
                    <span>Cancelling Bill...</span>
                  </>
                ) : (
                  'Yes, Cancel Entire Bill'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authoritative Printable Thermal Receipt Component */}
      <PrintableReceipt bill={bill} paperSize={paperSize} />
    </div>
  );
};

export default BillDetailPage;
