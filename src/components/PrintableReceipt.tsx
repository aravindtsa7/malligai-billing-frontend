import React from 'react';
import type { SerializedBill } from '../types/billing.types.ts';

export type PaperSize = '58mm' | '80mm';

export interface PrintableReceiptProps {
  bill: SerializedBill | null;
  paperSize?: PaperSize;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  bill,
  paperSize = '80mm',
}) => {
  if (!bill) return null;

  const isCancelled = bill.status === 'CANCELLED';

  const formattedDate = new Date(bill.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const formattedCancelledDate = bill.cancelledAt
    ? new Date(bill.cancelledAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  const totalItemsCount = bill.items?.length || 0;

  return (
    <div
      className={`printable-receipt-wrapper printable-receipt-${paperSize}`}
      data-testid="printable-receipt"
      aria-label="Printable Sales Receipt"
    >
      {/* Receipt Header */}
      <div className="receipt-header-section">
        <h1 className="receipt-shop-title">MALLIGAI BILLING</h1>
        <p className="receipt-shop-subtitle">Counter Sales Invoice</p>
        <div className="receipt-divider-line" />
        {isCancelled && (
          <div className="receipt-cancelled-header-tag">
            *** CANCELLED INVOICE ***
          </div>
        )}

        <div className="receipt-meta-rows">
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Bill No:</span>
            <span className="receipt-meta-value font-mono"><strong>{bill.billNumber}</strong></span>
          </div>
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Date:</span>
            <span className="receipt-meta-value">{formattedDate}</span>
          </div>
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Cashier:</span>
            <span className="receipt-meta-value">
              {bill.creator?.username || `User #${bill.createdBy}`}
              {bill.creator?.role ? ` (${bill.creator.role})` : ''}
            </span>
          </div>
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Rate Tier:</span>
            <span className="receipt-meta-value">{bill.rateType}</span>
          </div>
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Payment:</span>
            <span className="receipt-meta-value">{bill.paymentType}</span>
          </div>
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Status:</span>
            <span className="receipt-meta-value">
              <strong>{bill.status}</strong>
            </span>
          </div>
          {isCancelled && (
            <>
              {formattedCancelledDate && (
                <div className="receipt-meta-line">
                  <span className="receipt-meta-key">Voided At:</span>
                  <span className="receipt-meta-value">{formattedCancelledDate}</span>
                </div>
              )}
              {bill.canceller?.username && (
                <div className="receipt-meta-line">
                  <span className="receipt-meta-key">Voided By:</span>
                  <span className="receipt-meta-value">
                    {bill.canceller.username} ({bill.canceller.role})
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="receipt-divider-line" />
      {/* Items Section */}
      <div className="receipt-items-section">
        {paperSize === '80mm' ? (
          /* 80mm Layout: Compact 4-Column Table */
          <table className="receipt-table-80mm">
            <thead>
              <tr>
                <th className="th-r-sno">#</th>
                <th className="th-r-item">Item</th>
                <th className="th-r-qty text-center">Qty</th>
                <th className="th-r-rate text-right">Rate</th>
                <th className="th-r-amount text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items && bill.items.length > 0 ? (
                bill.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="td-r-sno">{idx + 1}</td>
                    <td className="td-r-item">
                      <div className="receipt-item-name-text">{item.productName}</div>
                      <div className="receipt-item-code-text">{item.productCode}</div>
                    </td>
                    <td className="td-r-qty text-center font-mono">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="td-r-rate text-right font-mono">â‚¹{item.rate}</td>
                    <td className="td-r-amount text-right font-mono">â‚¹{item.amount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center">No items recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* 58mm Layout: Narrow Stacked Layout to avoid cramping */
          <div className="receipt-list-58mm">
            <div className="receipt-58mm-header-row">
              <span>Item & Description</span>
              <span>Amount</span>
            </div>
            <div className="receipt-divider-dotted" />
            {bill.items && bill.items.length > 0 ? (
              bill.items.map((item, idx) => (
                <div key={item.id || idx} className="receipt-58mm-item-row">
                  <div className="receipt-58mm-item-title-row">
                    <span className="receipt-58mm-item-name">
                      {idx + 1}. {item.productName}
                    </span>
                    <span className="receipt-58mm-item-amount font-mono">
                      â‚¹{item.amount}
                    </span>
                  </div>
                  <div className="receipt-58mm-item-sub-row font-mono">
                    <span>{item.productCode}</span>
                    <span>
                      {item.quantity} {item.unit} Ã— â‚¹{item.rate}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center">No items recorded</div>
            )}
          </div>
        )}
      </div>
      <div className="receipt-divider-line" />
      {/* Totals Section */}
      <div className="receipt-totals-section">
        <div className="receipt-total-line">
          <span>Items Count:</span>
          <span className="font-mono">{totalItemsCount}</span>
        </div>
        <div className="receipt-total-line">
          <span>Subtotal:</span>
          <span className="font-mono">â‚¹{bill.subtotal}</span>
        </div>
        <div className="receipt-divider-dotted" />
        <div className="receipt-grand-total-line">
          <span>TOTAL AMOUNT:</span>
          <span className="receipt-grand-total-value font-mono">
            â‚¹{bill.totalAmount}
          </span>
        </div>
      </div>

      <div className="receipt-divider-line" />

      {/* Footer */}
      <div className="receipt-footer-section">
        {isCancelled ? (
          <div className="receipt-cancelled-footer-notice">
            *** VOID / CANCELLED BILL ***
            <br />
            Items returned to inventory stock
          </div>
        ) : (
          <div className="receipt-thankyou-message">
            Thank you! Visit again.
          </div>
        )}
      </div>
    </div>
  );
};
