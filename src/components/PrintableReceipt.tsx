import React from 'react';
import type { SerializedBill } from '../types/billing.types.ts';

export type PaperSize = '58mm' | '80mm';
export type ReceiptLanguage = 'ENGLISH' | 'TAMIL';

export interface PrintableReceiptProps {
  bill: SerializedBill | null;
  paperSize?: PaperSize;
  language?: ReceiptLanguage;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  bill,
  paperSize = '80mm',
  language = 'ENGLISH',
}) => {
  if (!bill) return null;

  const isCancelled = bill.status === 'CANCELLED';
  const snapshot = bill.receiptSnapshot;

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

  // Resolve item display name based on language
  const getItemDisplayName = (item: { productName: string; tamilName?: string | null }) => {
    if (language === 'TAMIL') {
      return item.tamilName && item.tamilName.trim() ? item.tamilName.trim() : item.productName;
    }
    return item.productName;
  };

  // Header texts
  const storeName = snapshot?.storeName?.trim() || 'MALLIGAI BILLING';
  const upiId = snapshot?.upiId?.trim() || null;
  const gstin = snapshot?.gstin?.trim() || null;

  // Visibility flags (default to true if snapshot is missing)
  const showCashier = snapshot ? snapshot.showCashier : true;
  const showRateTier = snapshot ? snapshot.showRateTier : true;
  const showPayment = snapshot ? snapshot.showPayment : true;
  const showStatus = snapshot ? snapshot.showStatus : true;

  // Language specific labels
  const totalLabel = language === 'TAMIL' ? 'மொத்தம்' : 'TOTAL AMOUNT';
  const thankYouText = language === 'TAMIL' ? 'நன்றி! மீண்டும் வருக!' : 'Thank you! Visit again.';

  return (
    <div
      className={`printable-receipt-wrapper printable-receipt-${paperSize}`}
      data-testid="printable-receipt"
      aria-label="Printable Sales Receipt"
    >
      {/* Receipt Header */}
      <div className="receipt-header-section">
        <h1 className="receipt-shop-title">{storeName}</h1>
        {upiId && <div className="receipt-shop-upi font-mono">{upiId}</div>}
        {gstin && <div className="receipt-shop-gstin font-mono">GSTIN: {gstin}</div>}
        <div className="receipt-divider-line" />

        {isCancelled && (
          <div className="receipt-cancelled-header-tag">
            *** CANCELLED INVOICE ***
          </div>
        )}

        {/* Bill Metadata */}
        <div className="receipt-meta-rows">
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Bill No:</span>
            <span className="receipt-meta-value font-mono">
              <strong>{bill.billNumber}</strong>
            </span>
          </div>
          <div className="receipt-meta-line">
            <span className="receipt-meta-key">Date:</span>
            <span className="receipt-meta-value">{formattedDate}</span>
          </div>
          {showCashier && (
            <div className="receipt-meta-line">
              <span className="receipt-meta-key">Cashier:</span>
              <span className="receipt-meta-value">
                {bill.creator?.username || `User #${bill.createdBy}`}
                {bill.creator?.role ? ` (${bill.creator.role})` : ''}
              </span>
            </div>
          )}
          {showRateTier && (
            <div className="receipt-meta-line">
              <span className="receipt-meta-key">Rate Tier:</span>
              <span className="receipt-meta-value">{bill.rateType}</span>
            </div>
          )}
          {showPayment && (
            <div className="receipt-meta-line">
              <span className="receipt-meta-key">Payment:</span>
              <span className="receipt-meta-value">{bill.paymentType}</span>
            </div>
          )}
          {showStatus && (
            <div className="receipt-meta-line">
              <span className="receipt-meta-key">Status:</span>
              <span className="receipt-meta-value">
                <strong>{bill.status}</strong>
              </span>
            </div>
          )}
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
          /* 80mm Layout: 4-Column Compact Thermal Table (Item Name | Rate | Qty | Amount) */
          <table className="receipt-table-80mm">
            <thead>
              <tr>
                <th className="th-r-name">Item Name</th>
                <th className="th-r-rate text-right">Rate</th>
                <th className="th-r-qty text-center">Qty</th>
                <th className="th-r-amount text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items && bill.items.length > 0 ? (
                bill.items.map((item, idx) => {
                  const displayName = getItemDisplayName(item);
                  return (
                    <tr key={item.id || idx}>
                      <td className="td-r-name">
                        <div className="receipt-item-name-text">{displayName}</div>
                      </td>
                      <td className="td-r-rate text-right font-mono">{item.rate}</td>
                      <td className="td-r-qty text-center font-mono">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="td-r-amount text-right font-mono">{item.amount}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="text-center">No items recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* 58mm Layout: Compact Stacked Layout (Item Name / Rate  Qty  Amount) */
          <div className="receipt-list-58mm">
            <div className="receipt-58mm-header-row">
              <span className="th-r-58-name">Item Name</span>
              <span className="th-r-58-details">Rate / Qty / Amount</span>
            </div>
            <div className="receipt-divider-dotted" />
            {bill.items && bill.items.length > 0 ? (
              bill.items.map((item, idx) => {
                const displayName = getItemDisplayName(item);
                return (
                  <div key={item.id || idx} className="receipt-58mm-item-row">
                    <div className="receipt-58mm-item-name">{displayName}</div>
                    <div className="receipt-58mm-item-details-row font-mono">
                      <span className="receipt-58mm-rate">{item.rate}</span>
                      <span className="receipt-58mm-qty">{item.quantity} {item.unit}</span>
                      <span className="receipt-58mm-amount font-bold">{item.amount}</span>
                    </div>
                  </div>
                );
              })
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
          <span className="font-mono">{bill.subtotal}</span>
        </div>
        <div className="receipt-divider-dotted" />
        <div className="receipt-grand-total-line">
          <span className="receipt-grand-total-label">{totalLabel}:</span>
          <span className="receipt-grand-total-value font-mono">
            {bill.totalAmount}
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
            {thankYouText}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintableReceipt;
