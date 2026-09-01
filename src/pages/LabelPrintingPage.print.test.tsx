import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Product } from '../types/product.types.ts';
import type { LabelSettings } from '../types/label-settings.types.ts';

// Mocks are declared via vi.hoisted so they exist before the vi.mock factories below run
// (vi.mock calls are hoisted above imports by vitest).
const mocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
  searchProducts: vi.fn(),
  getProductById: vi.fn(),
  getLabelSettings: vi.fn(),
  updateLabelSettings: vi.fn(),
  invalidCodes: new Set<string>(),
}));

vi.mock('../api/product.api.ts', () => ({
  productApi: {
    listProducts: mocks.listProducts,
    searchProducts: mocks.searchProducts,
    getProductById: mocks.getProductById,
  },
}));

vi.mock('../api/label-settings.api.ts', () => ({
  labelSettingsApi: {
    getLabelSettings: mocks.getLabelSettings,
    updateLabelSettings: mocks.updateLabelSettings,
  },
}));

// api-client.ts throws at module-load time if VITE_API_BASE_URL is unset, which it is in the
// test env — so it's mocked wholesale rather than fighting env var propagation.
vi.mock('../api/api-client.ts', () => ({
  getApiErrorMessage: (error: unknown, fallback = 'error') =>
    error instanceof Error ? error.message : fallback,
}));

// Real JsBarcode does real canvas/SVG path-drawing math that jsdom can't usefully exercise;
// this mock reproduces exactly the two outcomes ProductLabel's effect branches on: it either
// appends a child to the target SVG (success) or throws (failure), keyed by the encoded value.
vi.mock('jsbarcode', () => ({
  default: (element: SVGSVGElement, value: string) => {
    if (mocks.invalidCodes.has(value)) {
      throw new Error('mock JsBarcode encode failure');
    }
    element.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
  },
}));

const { LabelPrintingPage } = await import('./LabelPrintingPage.tsx');

const baseProduct: Product = {
  id: 1,
  productCode: '1211',
  barcode: 'MFR-0009',
  productName: 'OLD NAME',
  tamilName: null,
  categoryId: 1,
  category: undefined,
  unit: 'PIECE',
  mrpRate: '100.00',
  originalRate: '90.00',
  normalRate: '95.00',
  retailRate: '100.00',
  functionRate: '98.00',
  currentStock: '10',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const baseSettings: LabelSettings = {
  storeName: 'TEST STORE',
  defaultLabelSize: 'LABEL_50X40',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let printSpy: ReturnType<typeof vi.fn>;

const renderPage = () => {
  const appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
  return render(
    <MemoryRouter>
      <LabelPrintingPage />
    </MemoryRouter>,
    { container: appRoot },
  );
};

const selectBaseProduct = async () => {
  const selectBtn = await screen.findByRole('button', { name: 'Select' });
  fireEvent.click(selectBtn);
  await waitFor(() => expect(screen.getByRole('button', { name: /Print Labels/ })).not.toBeDisabled());
};

const getPrintableContainerText = () => screen.getByTestId('printable-labels-container').textContent ?? '';

const getPrintableProductCodes = () => Array.from(
  screen.getByTestId('printable-labels-container').querySelectorAll('.label-product-code'),
).map((el) => el.textContent);

const getPrintableRows = () => screen.getByTestId('printable-labels-container')
  .querySelectorAll('.printable-label-row');

const getEmptySlots = () => screen.getByTestId('printable-labels-container')
  .querySelectorAll('.empty-label-slot');

beforeEach(() => {
  mocks.invalidCodes.clear();
  mocks.listProducts.mockReset().mockResolvedValue([baseProduct]);
  mocks.searchProducts.mockReset().mockResolvedValue([baseProduct]);
  mocks.getProductById.mockReset();
  mocks.getLabelSettings.mockReset().mockResolvedValue(baseSettings);
  mocks.updateLabelSettings.mockReset();
  printSpy = vi.fn();
  window.print = printSpy as unknown as typeof window.print;
});

afterEach(() => {
  cleanup();
  document.getElementById('root')?.remove();
  vi.restoreAllMocks();
});

describe('LabelPrintingPage print readiness', () => {
  it('same productCode, refreshed productName/mrpRate: waits for the refreshed printable copy before printing', async () => {
    mocks.getProductById.mockResolvedValueOnce({
      ...baseProduct,
      productName: 'NEW NAME',
      mrpRate: '150.00',
    });

    renderPage();
    await selectBaseProduct();

    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

    const printedText = getPrintableContainerText();
    expect(printedText).toContain('NEW NAME');
    expect(printedText).toContain('150.00');
    expect(printedText).not.toContain('OLD NAME');
  });

  it('productCode changes on refresh (1211 -> 001211): every printable copy encodes the new code, never the stale one', async () => {
    mocks.getProductById.mockResolvedValueOnce({
      ...baseProduct,
      productCode: '001211',
    });

    renderPage();
    await selectBaseProduct();

    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

    const codes = getPrintableProductCodes();
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(code).toBe('001211');
    }
  });

  it('copies=5: prints exactly once after all 5 actual labels are ready across 2 rows', async () => {
    mocks.getProductById.mockResolvedValueOnce({ ...baseProduct });

    renderPage();
    await selectBaseProduct();

    fireEvent.change(screen.getByLabelText(/Copies/), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(getPrintableProductCodes()).toHaveLength(5);
    expect(getPrintableRows()).toHaveLength(2);
    expect(getEmptySlots()).toHaveLength(3);
  });

  it('invalid product code (any printable copy invalid aborts the whole attempt): never calls window.print and shows a visible error', async () => {
    // All copies render the same product+size, so an unencodable code fails uniformly across
    // every copy — the real-world manifestation of "any copy invalid" (fail-fast is unit-tested
    // in isolation in labelPrintReadiness.test.ts for a genuinely mixed valid/invalid batch).
    mocks.invalidCodes.add('1211');

    renderPage();
    const selectBtn = await screen.findByRole('button', { name: 'Select' });
    fireEvent.click(selectBtn);

    // Print button is disabled once the live preview itself reports invalid.
    await waitFor(() => expect(screen.getByRole('button', { name: /Print Labels/ })).toBeDisabled());
    expect(printSpy).not.toHaveBeenCalled();
    expect(mocks.getProductById).not.toHaveBeenCalled();
    expect(screen.getByText('Barcode could not be generated for this Product Code.')).toBeInTheDocument();
  });

  it('refresh reveals the product is now inactive: aborts before printing, does not start a readiness wait', async () => {
    mocks.getProductById.mockResolvedValueOnce({ ...baseProduct, active: false });

    renderPage();
    await selectBaseProduct();

    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));

    await screen.findByText('This product is now inactive. Labels were not printed.');
    expect(printSpy).not.toHaveBeenCalled();
  });

  it('refresh fetch fails (network error): aborts visibly, does not print, and resets the printing guard', async () => {
    mocks.getProductById.mockRejectedValueOnce(new Error('network down'));

    renderPage();
    await selectBaseProduct();

    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));

    await screen.findByText('network down');
    expect(printSpy).not.toHaveBeenCalled();
    // Guard must reset through `finally` so the button becomes clickable again.
    await waitFor(() => expect(screen.getByRole('button', { name: /Print Labels/ })).not.toBeDisabled());
  });

  it('rapid double click only performs one refresh fetch and one print', async () => {
    let resolveFetch: (p: Product) => void = () => {};
    mocks.getProductById.mockReturnValueOnce(new Promise<Product>((resolve) => {
      resolveFetch = resolve;
    }));

    renderPage();
    await selectBaseProduct();

    const printButton = screen.getByRole('button', { name: /Print Labels/ });
    fireEvent.click(printButton);
    fireEvent.click(printButton); // second click while the first attempt's fetch is still pending
    fireEvent.click(printButton);

    expect(mocks.getProductById).toHaveBeenCalledTimes(1);

    resolveFetch({ ...baseProduct });

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(mocks.getProductById).toHaveBeenCalledTimes(1);
  });

  it('two sequential fixed-profile print attempts each require fresh readiness, with no stale carry-over', async () => {
    mocks.getProductById
      .mockResolvedValueOnce({ ...baseProduct })
      .mockResolvedValueOnce({ ...baseProduct });

    renderPage();
    await selectBaseProduct();

    // First attempt at the fixed 25mm four-up profile.
    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

    // A second attempt must use a new revision rather than reusing the first attempt's reports.
    fireEvent.click(screen.getByRole('button', { name: /Print Labels/ }));

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(2));
    expect(mocks.getProductById).toHaveBeenCalledTimes(2);
  });

  it.each([
    { copies: 1, labels: 1, rows: 1, placeholders: 3 },
    { copies: 2, labels: 2, rows: 1, placeholders: 2 },
    { copies: 4, labels: 4, rows: 1, placeholders: 0 },
    { copies: 5, labels: 5, rows: 2, placeholders: 3 },
    { copies: 20, labels: 20, rows: 5, placeholders: 0 },
  ])('renders $copies actual labels as $rows four-column physical rows', async ({
    copies,
    labels,
    rows,
    placeholders,
  }) => {
    renderPage();
    await selectBaseProduct();

    fireEvent.change(screen.getByLabelText(/Copies/), { target: { value: String(copies) } });

    await waitFor(() => expect(getPrintableProductCodes()).toHaveLength(labels));
    expect(getPrintableRows()).toHaveLength(rows);
    expect(getEmptySlots()).toHaveLength(placeholders);
    expect(getPrintableRows()[getPrintableRows().length - 1]).toBe(
      screen.getByTestId('printable-labels-container').lastElementChild,
    );
  });

  it('isolates printable rows in a direct-body portal outside #root without duplicating the preview', async () => {
    const view = renderPage();
    await selectBaseProduct();

    fireEvent.change(screen.getByLabelText(/Copies/), { target: { value: '2' } });

    const printRoot = screen.getByTestId('printable-labels-container');
    await waitFor(() => expect(printRoot.querySelectorAll('.product-label-card')).toHaveLength(2));

    expect(printRoot.id).toBe('label-print-root');
    expect(printRoot.parentElement).toBe(document.body);
    expect(view.container.id).toBe('root');
    expect(view.container).not.toContainElement(printRoot);
    expect(document.body).toHaveClass('label-printing-mode');
    expect(Array.from(printRoot.children).every((child) => child.classList.contains('printable-label-row'))).toBe(true);
    expect(printRoot.querySelector('.preview-label-item')).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('.preview-label-item')).toHaveLength(1);

    view.unmount();
    expect(document.getElementById('label-print-root')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('label-printing-mode');
  });
});
