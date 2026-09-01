import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SerializedBill } from '../types/billing.types.ts';
import { PrintableReceipt } from './PrintableReceipt.tsx';

const bill: SerializedBill = {
  id: 1,
  billNumber: 'B-1',
  rateType: 'NORMAL',
  paymentType: 'CASH',
  subtotal: '75.00',
  totalAmount: '75.00',
  status: 'COMPLETED',
  createdBy: 1,
  receiptSnapshot: {
    storeName: 'MALLIGAI',
    upiId: null,
    gstin: null,
    showCashier: true,
    showRateTier: true,
    showPayment: true,
    showStatus: true,
  },
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  items: [],
};

afterEach(cleanup);

describe('PrintableReceipt paper profiles', () => {
  it('uses the 77mm wrapper and four-column receipt profile', () => {
    render(<PrintableReceipt bill={bill} paperSize="77mm" />);

    expect(screen.getByTestId('printable-receipt')).toHaveClass('printable-receipt-77mm');
    expect(document.querySelector('.receipt-table-77mm')).toBeInTheDocument();
  });

  it('preserves the existing 58mm stacked profile', () => {
    render(<PrintableReceipt bill={bill} paperSize="58mm" />);

    expect(screen.getByTestId('printable-receipt')).toHaveClass('printable-receipt-58mm');
    expect(document.querySelector('.receipt-list-58mm')).toBeInTheDocument();
  });
});
