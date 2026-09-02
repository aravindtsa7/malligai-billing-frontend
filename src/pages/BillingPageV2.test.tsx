import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Product } from '../types/product.types.ts';
import type { SerializedBill } from '../types/billing.types.ts';

// Hoisted mocks for API and Auth
const mocks = vi.hoisted(() => ({
  user: { id: 1, username: 'admin', role: 'ADMIN' },
  isAuthenticated: true,
  loading: false,
  getProductByScanValue: vi.fn(),
  searchProducts: vi.fn(),
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  createBill: vi.fn(),
  listBills: vi.fn(),
}));

vi.mock('../auth/useAuth.ts', () => ({
  useAuth: () => ({
    user: mocks.user,
    isAuthenticated: mocks.isAuthenticated,
    loading: mocks.loading,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../api/product.api.ts', () => ({
  productApi: {
    getProductByScanValue: mocks.getProductByScanValue,
    searchProducts: mocks.searchProducts,
    listProducts: mocks.listProducts,
  },
}));

vi.mock('../api/category.api.ts', () => ({
  categoryApi: {
    listCategories: mocks.listCategories,
  },
}));

vi.mock('../api/billing.api.ts', () => ({
  billingApi: {
    createBill: mocks.createBill,
    listBills: mocks.listBills,
  },
}));

vi.mock('../api/api-client.ts', () => ({
  AUTH_TOKEN_KEY: 'malligai_auth_token',
  AUTH_UNAUTHORIZED_EVENT: 'malligai_auth_unauthorized',
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getApiErrorMessage: (err: unknown, fallback: string) => {
    if (err && typeof err === 'object') {
      const maybeAxios = err as { response?: { data?: { message?: string } }; message?: string };
      if (maybeAxios.response?.data?.message) {
        return maybeAxios.response.data.message;
      }
      if (typeof maybeAxios.message === 'string') {
        return maybeAxios.message;
      }
    }
    return fallback;
  },
}));

// Import App after mocks
const { App } = await import('../App.tsx');

const sampleProductA: Product = {
  id: 101,
  productCode: '0042',
  barcode: '8901234567890',
  productName: 'Ponni Rice 1kg',
  tamilName: 'பொன்னி அரிசி',
  categoryId: 1,
  unit: 'KG',
  mrpRate: '75.00',
  originalRate: '50.00',
  normalRate: '65.00',
  retailRate: '60.00',
  functionRate: '55.00',
  currentStock: '50.000',
  active: true,
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
};

const sampleProductB: Product = {
  id: 102,
  productCode: '0043',
  barcode: '8901234567891',
  productName: 'Sugar 1kg',
  tamilName: 'சர்க்கரை',
  categoryId: 1,
  unit: 'KG',
  mrpRate: '45.00',
  originalRate: '35.00',
  normalRate: '42.00',
  retailRate: '40.00',
  functionRate: '38.00',
  currentStock: '20.000',
  active: true,
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
};

const sampleOutOfStockProduct: Product = {
  id: 103,
  productCode: '0099',
  barcode: '8901234567899',
  productName: 'Cardamom 50g',
  tamilName: 'ஏலக்காய்',
  categoryId: 1,
  unit: 'GRAM',
  mrpRate: '150.00',
  originalRate: '100.00',
  normalRate: '130.00',
  retailRate: '120.00',
  functionRate: '110.00',
  currentStock: '0.000',
  active: true,
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
};

const sampleInactiveProduct: Product = {
  id: 104,
  productCode: '0100',
  barcode: '8901234567800',
  productName: 'Old Ghee 500ml',
  tamilName: 'நெய்',
  categoryId: 1,
  unit: 'LITRE',
  mrpRate: '350.00',
  originalRate: '280.00',
  normalRate: '320.00',
  retailRate: '310.00',
  functionRate: '300.00',
  currentStock: '10.000',
  active: false,
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
};

const mockSavedBill: SerializedBill = {
  id: 999,
  billNumber: 'BILL-20260902-0001',
  rateType: 'NORMAL',
  paymentType: 'CASH',
  subtotal: '65.00',
  totalAmount: '65.00',
  status: 'COMPLETED',
  createdBy: 1,
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T10:00:00Z',
  receiptSnapshot: {
    storeName: 'MALLIGAI MALIGAI',
    upiId: null,
    gstin: null,
    showCashier: true,
    showRateTier: true,
    showPayment: true,
    showStatus: true,
  },
  items: [
    {
      id: 1,
      billId: 999,
      productId: 101,
      productCode: '0042',
      productName: 'Ponni Rice 1kg',
      tamilName: 'பொன்னி அரிசி',
      unit: 'KG',
      quantity: '1',
      rateType: 'NORMAL',
      rate: '65.00',
      amount: '65.00',
      createdAt: '2026-09-02T10:00:00Z',
    },
  ],
  creator: {
    id: 1,
    username: 'admin',
    role: 'ADMIN',
  },
};

describe('Create Bill V2 — Phase 1 Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 1, username: 'admin', role: 'ADMIN' };
    mocks.isAuthenticated = true;
    mocks.loading = false;
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    mocks.searchProducts.mockResolvedValue([sampleProductA, sampleProductB]);
    mocks.listProducts.mockResolvedValue([sampleProductA, sampleProductB]);
    mocks.listCategories.mockResolvedValue([]);
    mocks.createBill.mockResolvedValue(mockSavedBill);
    mocks.listBills.mockResolvedValue({ bills: [], pagination: { totalPages: 1 } });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Route access ADMIN: renders /billing-v2 with focus-mode and V2 badge', async () => {
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Scan barcode or type code / product name...')).toBeInTheDocument();
    });

    // Verify sidebar shows both Create Bill and Create Bill V2
    expect(screen.getByRole('link', { name: /Create Bill V2/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Create Bill$/i })).toBeInTheDocument();
  });

  it('2. Route access SALESMAN: allows salesman into /billing-v2', async () => {
    mocks.user = { id: 2, username: 'salesman1', role: 'SALESMAN' };
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Scan barcode or type code / product name...')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Create Bill V2/i })).toBeInTheDocument();
  });

  it('3. Leading-zero productCode: survives exact lookup without parseInt truncation', async () => {
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mocks.getProductByScanValue).toHaveBeenCalledWith('0042');
    });

    // Cart row contains code with leading zeros intact
    await waitFor(() => {
      expect(screen.getByText('0042')).toBeInTheDocument();
    });
  });

  it('4. Exact barcode scan: adds product to cart', async () => {
    mocks.getProductByScanValue.mockResolvedValueOnce(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '8901234567890' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
    });
  });

  it('5. productCode scan: adds product using product code', async () => {
    mocks.getProductByScanValue.mockResolvedValueOnce(sampleProductB);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0043' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
    });
  });

  it('6. Manual autocomplete selection: adds clicked suggestion and clears input', async () => {
    mocks.searchProducts.mockResolvedValueOnce([sampleProductB]);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: 'Sugar' } });

    await waitFor(() => {
      expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
    });

    // Click on suggestion
    const suggestion = screen.getByText('Sugar 1kg').closest('li')!;
    fireEvent.click(suggestion);

    await waitFor(() => {
      // In cart table
      expect(screen.getByText('0043')).toBeInTheDocument();
      // Input cleared
      expect(input).toHaveValue('');
    });
  });

  it('7. ArrowDown/ArrowUp/Enter: selects suggestion via keyboard', async () => {
    // Exact scan lookup returns not found, so Enter falls back to highlighted suggestion
    mocks.getProductByScanValue.mockRejectedValue(new Error('404 Not Found'));
    mocks.getProductByScanValue.mockRejectedValue({ response: { status: 404 } });
    mocks.searchProducts.mockResolvedValue([sampleProductA, sampleProductB]);

    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: 'rice' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // ArrowDown moves highlight to 2nd item (Sugar 1kg)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Press Enter to submit
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      // Sugar 1kg should be added
      expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
    });
  });

  it('8. Escape closes dropdown', async () => {
    mocks.searchProducts.mockResolvedValue([sampleProductA]);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: 'Ponni' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('9. Rapid A/B/C scan FIFO: executes sequentially in exact order', async () => {
    const scanLog: string[] = [];
    mocks.getProductByScanValue.mockImplementation(async (val: string) => {
      scanLog.push(`start-${val}`);
      await new Promise((r) => setTimeout(r, 15));
      scanLog.push(`end-${val}`);
      return { ...sampleProductA, id: Math.random(), productCode: val, productName: `Product ${val}` };
    });

    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');

    // Rapid scans A -> B -> C
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.submit(input.closest('form')!);

    fireEvent.change(input, { target: { value: 'B' } });
    fireEvent.submit(input.closest('form')!);

    fireEvent.change(input, { target: { value: 'C' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(scanLog).toEqual([
        'start-A',
        'end-A',
        'start-B',
        'end-B',
        'start-C',
        'end-C',
      ]);
    });
  });

  it('10. Repeated same product: increments quantity without duplicate rows', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');

    // Scan 1
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
    });

    // Scan 2
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      const qtyInputs = screen.getAllByLabelText('Quantity for Ponni Rice 1kg');
      expect(qtyInputs).toHaveLength(1); // Only 1 row
      expect(qtyInputs[0]).toHaveValue('2'); // Incremented to 2
    });
  });

  it('11. Out-of-stock blocking: prevents adding product with 0 stock', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleOutOfStockProduct);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0099' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
      expect(screen.queryByText('Cardamom 50g')).not.toBeInTheDocument();
    });
  });

  it('12. Inactive product blocking: prevents adding inactive product', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleInactiveProduct);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0100' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/inactive and cannot be billed/i)).toBeInTheDocument();
      expect(screen.queryByText('Old Ghee 500ml')).not.toBeInTheDocument();
    });
  });

  it('13. Fractional qty: supports decimal quantity edits and calculates exact line amount', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toBeInTheDocument();
    });

    const qtyInput = screen.getByLabelText('Quantity for Ponni Rice 1kg');
    // Normal rate is 65.00; qty = 1.5 -> amount = 97.50
    fireEvent.change(qtyInput, { target: { value: '1.5' } });

    await waitFor(() => {
      expect(screen.getAllByText('₹97.50').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('14. Exact stock limit: warns and disables Save Bill when exceeding stock', async () => {
    // Product has 50 stock
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toBeInTheDocument();
    });

    const qtyInput = screen.getByLabelText('Quantity for Ponni Rice 1kg');
    fireEvent.change(qtyInput, { target: { value: '55' } }); // 55 > 50

    await waitFor(() => {
      expect(screen.getByText(/Exceeds stock/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /SAVE BILL/i })).toBeDisabled();
    });
  });

  it('15. Rate-tier recalculation: switching to RETAIL updates rates and amounts', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      // Normal rate: 65.00
      expect(screen.getAllByText('₹65.00').length).toBeGreaterThanOrEqual(1);
    });

    // Switch to RETAIL (rate: 60.00)
    const retailBtn = screen.getByRole('radio', { name: 'RETAIL' });
    fireEvent.click(retailBtn);

    await waitFor(() => {
      expect(screen.getAllByText('₹60.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('16. Total calculation: matches exact decimal sum of cart items', async () => {
    mocks.getProductByScanValue
      .mockResolvedValueOnce(sampleProductA) // normalRate: 65.00
      .mockResolvedValueOnce(sampleProductB); // normalRate: 42.00

    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');

    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: '0043' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
    });

    // 65.00 + 42.00 = 107.00
    // The large total display at top-right
    expect(screen.getByText('₹107.00')).toBeInTheDocument();
  });

  it('17. F2 focus: refocuses and selects Smart Product Entry', async () => {
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: 'F2' });

    expect(document.activeElement).toBe(input);
  });

  it('18. F4 save: triggers Save Bill and shows receipt modal', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'F4' });

    await waitFor(() => {
      expect(mocks.createBill).toHaveBeenCalledWith({
        rateType: 'NORMAL',
        paymentType: 'CASH',
        items: [{ productId: 101, quantity: '1' }],
      });
      expect(screen.getByText('Bill Created Successfully')).toBeInTheDocument();
    });
  });

  it('19. Ctrl+Enter save: triggers Save Bill', async () => {
    mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
    window.history.pushState({}, '', '/billing-v2');
    render(<App />);

    const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
    fireEvent.change(input, { target: { value: '0042' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mocks.createBill).toHaveBeenCalled();
    });
  });

  it('20. V1 /billing unaffected: stable Billing terminal remains functional', async () => {
    window.history.pushState({}, '', '/billing');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Malligai Counter Checkout')).toBeInTheDocument();
      expect(screen.getByText('All Products')).toBeInTheDocument();
    });
  });

  describe('Create Bill V2 — Final Scanner / F3 Safety Corrections', () => {
    it('A. Scan API 404 + matching current manual suggestion: intended fallback works', async () => {
      mocks.getProductByScanValue.mockRejectedValue({ response: { status: 404 } });
      mocks.searchProducts.mockResolvedValue([sampleProductB]); // Sugar 1kg

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: 'Sugar' } });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
      });

      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(mocks.getProductByScanValue).toHaveBeenCalledWith('Sugar');
        expect(screen.getAllByText('Sugar 1kg').length).toBeGreaterThanOrEqual(1);
        expect(input).toHaveValue('');
      });
    });

    it('B. Scan API 500 + highlighted suggestion: nothing added, visible error', async () => {
      mocks.getProductByScanValue.mockRejectedValue({
        response: { status: 500, data: { message: 'Internal Server Error' } },
      });
      mocks.searchProducts.mockResolvedValue([sampleProductB]);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: 'Sugar' } });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
      });

      // Nothing added to cart
      expect(screen.getByText('Terminal Ready for Billing')).toBeInTheDocument();
      expect(screen.queryByLabelText('Quantity for Sugar 1kg')).not.toBeInTheDocument();
    });

    it('C. Network rejection + highlighted suggestion: nothing added, FIFO remains usable for next valid scan', async () => {
      mocks.getProductByScanValue
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce(sampleProductA);
      mocks.searchProducts.mockResolvedValue([sampleProductB]);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: 'Sugar' } });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText('Quantity for Sugar 1kg')).not.toBeInTheDocument();

      // Next scan of 0042 must succeed via FIFO queue
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toBeInTheDocument();
      });
    });

    it('D. Unknown barcode + stale suggestion from previous query: nothing added', async () => {
      mocks.getProductByScanValue.mockRejectedValue({ response: { status: 404 } });
      mocks.searchProducts.mockResolvedValue([sampleProductB]); // Suggestions for 'Sugar'

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: 'Sugar' } });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Hardware barcode scan arrives with a totally different unknown barcode
      fireEvent.change(input, { target: { value: '8901234567999' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Product not found for "8901234567999".')).toBeInTheDocument();
      });

      // Stale Sugar suggestion was NOT added
      expect(screen.getByText('Terminal Ready for Billing')).toBeInTheDocument();
      expect(screen.queryByLabelText('Quantity for Sugar 1kg')).not.toBeInTheDocument();
    });

    it('E. Physical scan product A, then manual autocomplete product B, press F3: quantity input for B receives focus', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
      mocks.searchProducts.mockResolvedValue([sampleProductB]);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');

      // 1. Physical scan Product A (Ponni Rice)
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toBeInTheDocument();
      });

      // 2. Manual autocomplete selection for Product B (Sugar)
      fireEvent.change(input, { target: { value: 'Sugar' } });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const suggestion = screen.getByText('Sugar 1kg').closest('li')!;
      fireEvent.click(suggestion);

      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Sugar 1kg')).toBeInTheDocument();
      });

      // 3. Press F3 shortcut: MUST target last successfully added product (Sugar 1kg)
      fireEvent.keyDown(window, { key: 'F3' });

      const qtyA = screen.getByLabelText('Quantity for Ponni Rice 1kg');
      const qtyB = screen.getByLabelText('Quantity for Sugar 1kg');

      expect(qtyB).toHaveFocus();
      expect(qtyA).not.toHaveFocus();
    });

    it('F. Physical scan A, physical scan B, press F3: B quantity receives focus', async () => {
      mocks.getProductByScanValue
        .mockResolvedValueOnce(sampleProductA)
        .mockResolvedValueOnce(sampleProductB);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');

      // 1. Physical scan A
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toBeInTheDocument();
      });

      // 2. Physical scan B
      fireEvent.change(input, { target: { value: '0043' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Sugar 1kg')).toBeInTheDocument();
      });

      // 3. Press F3: targets last physically scanned product B
      fireEvent.keyDown(window, { key: 'F3' });

      const qtyB = screen.getByLabelText('Quantity for Sugar 1kg');
      expect(qtyB).toHaveFocus();
    });

    it('G. Existing rapid A/B/C FIFO still passes with physical scan targets updated in sequence', async () => {
      const sampleProductC: Product = {
        ...sampleProductA,
        id: 103,
        productCode: '0044',
        productName: 'Toor Dal 1kg',
        normalRate: '120.00',
      };

      mocks.getProductByScanValue
        .mockResolvedValueOnce(sampleProductA)
        .mockResolvedValueOnce(sampleProductB)
        .mockResolvedValueOnce(sampleProductC);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');

      // Rapidly fire A, B, C
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);

      fireEvent.change(input, { target: { value: '0043' } });
      fireEvent.submit(input.closest('form')!);

      fireEvent.change(input, { target: { value: '0044' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
        expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
        expect(screen.getByText('Toor Dal 1kg')).toBeInTheDocument();
      });

      // F3 should focus C (the last item in rapid sequence)
      fireEvent.keyDown(window, { key: 'F3' });
      expect(screen.getByLabelText('Quantity for Toor Dal 1kg')).toHaveFocus();
    });
  });

  describe('Focus-Mode Sidebar Preference Leak Invariant', () => {
    it('preserves expanded sidebar preference across /billing-v2 navigation', async () => {
      // A. Start with sidebar preference expanded
      localStorage.setItem('malligai_sidebar_collapsed', 'false');
      window.history.pushState({}, '', '/billing');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText('Sidebar Navigation')).toBeInTheDocument();
      });

      const sidebar = screen.getByLabelText('Sidebar Navigation');
      expect(sidebar).not.toHaveClass('sidebar-collapsed');
      expect(localStorage.getItem('malligai_sidebar_collapsed')).toBe('false');

      // B. Open /billing-v2
      const v2Link = screen.getByRole('link', { name: /Create Bill V2/i });
      fireEvent.click(v2Link);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Scan barcode or type code / product name...')).toBeInTheDocument();
      });

      // C. V2 is visually collapsed
      expect(sidebar).toHaveClass('sidebar-collapsed');

      // D. Ensure the focus-mode page cannot mutate persisted preference
      const toggleBtn = screen.getByLabelText('Toggle Sidebar');
      expect(toggleBtn).toBeDisabled();
      fireEvent.click(toggleBtn);
      expect(localStorage.getItem('malligai_sidebar_collapsed')).toBe('false');

      // E. Navigate away
      const billingLink = screen.getByRole('link', { name: /^Create Bill$/i });
      fireEvent.click(billingLink);

      await waitFor(() => {
        expect(screen.getByText('Billing Terminal')).toBeInTheDocument();
      });

      // F. Sidebar is expanded again
      expect(sidebar).not.toHaveClass('sidebar-collapsed');
      expect(localStorage.getItem('malligai_sidebar_collapsed')).toBe('false');
    });

    it('preserves collapsed sidebar preference across /billing-v2 navigation', async () => {
      // Start with sidebar preference collapsed
      localStorage.setItem('malligai_sidebar_collapsed', 'true');
      window.history.pushState({}, '', '/billing');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText('Sidebar Navigation')).toBeInTheDocument();
      });

      const sidebar = screen.getByLabelText('Sidebar Navigation');
      expect(sidebar).toHaveClass('sidebar-collapsed');
      expect(localStorage.getItem('malligai_sidebar_collapsed')).toBe('true');

      // Open /billing-v2
      const v2Link = screen.getByRole('link', { name: /Create Bill V2/i });
      fireEvent.click(v2Link);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Scan barcode or type code / product name...')).toBeInTheDocument();
      });

      // V2 is visually collapsed
      expect(sidebar).toHaveClass('sidebar-collapsed');

      // Ensure focus-mode page cannot mutate persisted preference
      const toggleBtn = screen.getByLabelText('Toggle Sidebar');
      expect(toggleBtn).toBeDisabled();
      fireEvent.click(toggleBtn);
      expect(localStorage.getItem('malligai_sidebar_collapsed')).toBe('true');

      // Navigate away
      const billingLink = screen.getByRole('link', { name: /^Create Bill$/i });
      fireEvent.click(billingLink);

      await waitFor(() => {
        expect(screen.getByText('Billing Terminal')).toBeInTheDocument();
      });

      // Sidebar remains collapsed according to original preference
      expect(sidebar).toHaveClass('sidebar-collapsed');
      expect(localStorage.getItem('malligai_sidebar_collapsed')).toBe('true');
    });
  });

  describe('F6 Cart Review Input Isolation', () => {
    it('prevents scanner/manual input and autocomplete while F6 review is open, and safely restores input upon close', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
      mocks.searchProducts.mockResolvedValue([sampleProductB]);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const entryInput = screen.getByPlaceholderText('Scan barcode or type code / product name...');

      // 1. Add sampleProductA to cart
      fireEvent.change(entryInput, { target: { value: '0042' } });
      fireEvent.submit(entryInput.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
      });

      expect(mocks.getProductByScanValue).toHaveBeenCalledTimes(1);

      // 2. Open F6 Cart Review Modal
      fireEvent.keyDown(window, { key: 'F6' });

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Cart Review Modal' })).toBeInTheDocument();
      });

      // 3. Verify Smart Product Entry input is disabled while modal is open
      expect(entryInput).toBeDisabled();

      // 4. Attempt scanner / manual typing while review modal is open
      fireEvent.change(entryInput, { target: { value: '8901234567891' } });

      // Value in input remains untouched/empty
      expect(entryInput).toHaveValue('');

      // Attempt form submission
      fireEvent.submit(entryInput.closest('form')!);

      // Attempt Enter keydown
      fireEvent.keyDown(window, { key: 'Enter' });

      // No debounce search or new scan was triggered
      expect(mocks.getProductByScanValue).toHaveBeenCalledTimes(1);
      expect(mocks.searchProducts).not.toHaveBeenCalled();

      // Cart rows remain exactly unchanged (Product A is present, Product B is not)
      expect(screen.getAllByText('Ponni Rice 1kg').length).toBe(2);
      expect(screen.queryByText('Sugar 1kg')).not.toBeInTheDocument();

      // 5. Close review modal using Escape key
      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Cart Review Modal' })).not.toBeInTheDocument();
      });

      // 6. Verify Smart Product Entry is re-enabled and focused, and cart is intact
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
      expect(entryInput).not.toBeDisabled();
      await waitFor(() => {
        expect(entryInput).toHaveFocus();
      });
    });
  });

  describe('Failed Save Cart Retention', () => {
    it('retains all cart rows, quantities, and totals with visible error on createBill failure, keeping terminal usable', async () => {
      mocks.getProductByScanValue
        .mockResolvedValueOnce(sampleProductA) // normalRate: 65.00
        .mockResolvedValueOnce(sampleProductB); // normalRate: 42.00

      mocks.createBill.mockRejectedValueOnce(new Error('Network failure: billing server unreachable'));

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const entryInput = screen.getByPlaceholderText('Scan barcode or type code / product name...');

      // 1. Add Product A (Ponni Rice)
      fireEvent.change(entryInput, { target: { value: '0042' } });
      fireEvent.submit(entryInput.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
      });

      // 2. Add Product B (Sugar)
      fireEvent.change(entryInput, { target: { value: '0043' } });
      fireEvent.submit(entryInput.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
      });

      // 3. Set quantity for Product A to 2
      const qtyInputA = screen.getByLabelText('Quantity for Ponni Rice 1kg');
      fireEvent.change(qtyInputA, { target: { value: '2' } });

      // Total: 2 * 65.00 + 1 * 42.00 = 130.00 + 42.00 = 172.00
      await waitFor(() => {
        expect(screen.getByText('₹172.00')).toBeInTheDocument();
      });

      // 4. Press F4 to save
      fireEvent.keyDown(window, { key: 'F4' });

      // 5. Verify billingApi.createBill was called with correct payload contract
      await waitFor(() => {
        expect(mocks.createBill).toHaveBeenCalledWith({
          rateType: 'NORMAL',
          paymentType: 'CASH',
          items: [
            { productId: 101, quantity: '2' },
            { productId: 102, quantity: '1' },
          ],
        });
      });

      // 6. Visible save error appears
      await waitFor(() => {
        expect(screen.getByText('Network failure: billing server unreachable')).toBeInTheDocument();
      });

      // 7. Cart rows and quantities remain exactly unchanged
      expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument();
      expect(screen.getByText('Sugar 1kg')).toBeInTheDocument();
      expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toHaveValue('2');
      expect(screen.getByLabelText('Quantity for Sugar 1kg')).toHaveValue('1');

      // 8. Total remains unchanged
      expect(screen.getByText('₹172.00')).toBeInTheDocument();

      // 9. Smart Product Entry and cart are still usable after failure
      expect(entryInput).not.toBeDisabled();
      expect(qtyInputA).not.toBeDisabled();

      // 10. No receipt modal is displayed
      expect(screen.queryByText('Bill Created Successfully')).not.toBeInTheDocument();
      expect(screen.queryByText('Invoice recorded in database')).not.toBeInTheDocument();
    });
  });

  describe('Create Bill V2 — Final Counter UX Correction Suite', () => {
    // 1. F3 Tests
    it('manual autocomplete B -> F3 focuses B qty', async () => {
      mocks.searchProducts.mockResolvedValue([sampleProductB]);
      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: 'Sugar' } });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const suggestion = screen.getByText('Sugar 1kg').closest('li')!;
      fireEvent.click(suggestion);
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Sugar 1kg')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'F3' });
      expect(screen.getByLabelText('Quantity for Sugar 1kg')).toHaveFocus();
    });

    it('product code B -> F3 focuses B qty', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductB);
      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0043' } });
      fireEvent.submit(input.closest('form')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Sugar 1kg')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'F3' });
      expect(screen.getByLabelText('Quantity for Sugar 1kg')).toHaveFocus();
    });

    it('scan A -> manual B -> F3 focuses B', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
      mocks.searchProducts.mockResolvedValue([sampleProductB]);
      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      // Scan A
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Ponni Rice 1kg')).toBeInTheDocument();
      });

      // Manual B
      fireEvent.change(input, { target: { value: 'Sugar' } });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Sugar 1kg').closest('li')!);
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Sugar 1kg')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'F3' });
      expect(screen.getByLabelText('Quantity for Sugar 1kg')).toHaveFocus();
    });

    it('failed add after B -> F3 still focuses B', async () => {
      mocks.getProductByScanValue
        .mockResolvedValueOnce(sampleProductB)
        .mockRejectedValueOnce({ response: { status: 404, data: { message: 'Not found' } } });
      mocks.searchProducts.mockResolvedValue([]);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      // Add B
      fireEvent.change(input, { target: { value: '0043' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(screen.getByLabelText('Quantity for Sugar 1kg')).toBeInTheDocument();
      });

      // Attempt failed add (non-existent barcode 9999)
      fireEvent.change(input, { target: { value: '9999' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(screen.getByText('Product not found for "9999".')).toBeInTheDocument();
      });

      // F3 should still focus B
      fireEvent.keyDown(window, { key: 'F3' });
      expect(screen.getByLabelText('Quantity for Sugar 1kg')).toHaveFocus();
    });

    // 2. F6 Review Modal Tests
    it('F6 ArrowUp/ArrowDown navigation', async () => {
      mocks.getProductByScanValue
        .mockResolvedValueOnce(sampleProductA)
        .mockResolvedValueOnce(sampleProductB);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      // Add A & B
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      fireEvent.change(input, { target: { value: '0043' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Sugar 1kg')).toBeInTheDocument());

      // Open F6
      fireEvent.keyDown(window, { key: 'F6' });
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Cart Review Modal' })).toBeInTheDocument();
      });

      const rows = document.querySelectorAll('.review-table-row');
      expect(rows.length).toBe(2);
      expect(rows[0]).toHaveClass('review-row-selected');
      expect(rows[1]).not.toHaveClass('review-row-selected');

      // ArrowDown to select row 1 (Sugar)
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(rows[0]).not.toHaveClass('review-row-selected');
      expect(rows[1]).toHaveClass('review-row-selected');

      // ArrowUp to select row 0 (Ponni Rice)
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(rows[0]).toHaveClass('review-row-selected');
      expect(rows[1]).not.toHaveClass('review-row-selected');
    });

    it('F6 Enter qty edit', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA); // currentStock: 50.000

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      // Open F6
      fireEvent.keyDown(window, { key: 'F6' });
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Cart Review Modal' })).toBeInTheDocument();
      });

      // Press Enter to edit selected row qty
      fireEvent.keyDown(window, { key: 'Enter' });
      const editInput = screen.getByLabelText('Edit quantity for Ponni Rice 1kg');
      expect(editInput).toBeInTheDocument();
      expect(editInput).toHaveValue('1');

      // 1. Test invalid decimal rejection
      fireEvent.change(editInput, { target: { value: 'abc' } });
      fireEvent.keyDown(editInput, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid positive quantity.')).toBeInTheDocument();
      });
      // Qty badge retains original quantity '1'
      expect(screen.getByRole('button', { name: /1(\.0+)? KG/i })).toBeInTheDocument();

      // 2. Test exceeding stock rejection (stock is 50.000)
      fireEvent.keyDown(window, { key: 'Enter' }); // re-enter edit
      const editInput2 = screen.getByLabelText('Edit quantity for Ponni Rice 1kg');
      fireEvent.change(editInput2, { target: { value: '999' } });
      fireEvent.keyDown(editInput2, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByText(/Only 50 KG available in stock/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /1(\.0+)? KG/i })).toBeInTheDocument();

      // 3. Test valid quantity update
      fireEvent.keyDown(window, { key: 'Enter' });
      const editInput3 = screen.getByLabelText('Edit quantity for Ponni Rice 1kg');
      fireEvent.change(editInput3, { target: { value: '3.5' } });
      fireEvent.keyDown(editInput3, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /3\.5 KG/i })).toBeInTheDocument();
      });
    });

    it('F6 Delete removes selected row', async () => {
      mocks.getProductByScanValue
        .mockResolvedValueOnce(sampleProductA)
        .mockResolvedValueOnce(sampleProductB);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      fireEvent.change(input, { target: { value: '0043' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Sugar 1kg')).toBeInTheDocument());

      // Open F6
      fireEvent.keyDown(window, { key: 'F6' });
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Cart Review Modal' })).toBeInTheDocument();
      });

      // Press Delete on row 0 (Ponni Rice)
      fireEvent.keyDown(window, { key: 'Delete' });
      await waitFor(() => {
        const modal = screen.getByRole('dialog', { name: 'Cart Review Modal' });
        expect(within(modal).queryByText('Ponni Rice 1kg')).not.toBeInTheDocument();
        expect(within(modal).getByText('Sugar 1kg')).toBeInTheDocument();
      });

      // Press Delete on remaining row (Sugar) -> modal automatically closes
      fireEvent.keyDown(window, { key: 'Delete' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Cart Review Modal' })).not.toBeInTheDocument();
      });
      expect(screen.getByText('Terminal Ready for Billing')).toBeInTheDocument();
    });

    it('F6 Esc/F6 closes', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      // Open with F6
      fireEvent.keyDown(window, { key: 'F6' });
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Cart Review Modal' })).toBeInTheDocument();
      });

      // Close with Esc
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Cart Review Modal' })).not.toBeInTheDocument();
      });

      // Open with F6 again
      fireEvent.keyDown(window, { key: 'F6' });
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Cart Review Modal' })).toBeInTheDocument();
      });

      // Close with F6
      fireEvent.keyDown(window, { key: 'F6' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Cart Review Modal' })).not.toBeInTheDocument();
      });
    });

    // 3. F9 Print Receipt Tests
    it('F9 before save does nothing', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      // Press F9 before save
      fireEvent.keyDown(window, { key: 'F9' });
      expect(printSpy).not.toHaveBeenCalled();
      printSpy.mockRestore();
    });

    it('F9 after successful save invokes receipt print path once', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
      mocks.createBill.mockResolvedValue(mockSavedBill);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      // Save Bill
      fireEvent.keyDown(window, { key: 'F4' });
      await waitFor(() => {
        expect(screen.getByText('Bill Created Successfully')).toBeInTheDocument();
      });

      // Press F9 after save
      fireEvent.keyDown(window, { key: 'F9' });
      expect(printSpy).toHaveBeenCalledTimes(1);

      // Immediate duplicate F9 (within 500ms debounce cooldown or repeat event) is suppressed
      fireEvent.keyDown(window, { key: 'F9', repeat: true });
      fireEvent.keyDown(window, { key: 'F9' });
      expect(printSpy).toHaveBeenCalledTimes(1);

      printSpy.mockRestore();
    });

    it('F8 still changes receipt language', async () => {
      mocks.getProductByScanValue.mockResolvedValue(sampleProductA);
      mocks.createBill.mockResolvedValue(mockSavedBill);

      window.history.pushState({}, '', '/billing-v2');
      render(<App />);

      const input = screen.getByPlaceholderText('Scan barcode or type code / product name...');
      fireEvent.change(input, { target: { value: '0042' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.getByText('Ponni Rice 1kg')).toBeInTheDocument());

      // Save Bill
      fireEvent.keyDown(window, { key: 'F4' });
      await waitFor(() => {
        expect(screen.getByText('Bill Created Successfully')).toBeInTheDocument();
      });

      // Initially ENGLISH: EN button is active
      const enBtn = screen.getByRole('button', { name: 'EN' });
      const tamilBtn = screen.getByRole('button', { name: 'தமிழ்' });
      expect(enBtn).toHaveClass('btn-lang-active');
      expect(tamilBtn).not.toHaveClass('btn-lang-active');

      // Press F8 -> toggles to TAMIL
      fireEvent.keyDown(window, { key: 'F8' });
      expect(tamilBtn).toHaveClass('btn-lang-active');
      expect(enBtn).not.toHaveClass('btn-lang-active');

      // Press F8 -> toggles back to ENGLISH
      fireEvent.keyDown(window, { key: 'F8' });
      expect(enBtn).toHaveClass('btn-lang-active');
      expect(tamilBtn).not.toHaveClass('btn-lang-active');
    });

    it('V1 /billing untouched', async () => {
      window.history.pushState({}, '', '/billing');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Malligai Counter Checkout')).toBeInTheDocument();
      });
    });
  });
});
