import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Category } from '../types/category.types.ts';
import type { UnitOfMeasure } from '../types/unit.types.ts';
import type { Product } from '../types/product.types.ts';
import ProductFormPage from './ProductFormPage.tsx';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  getProductById: vi.fn(),
  updateProduct: vi.fn(),
  listCategories: vi.fn(),
  listUnits: vi.fn(),
}));

vi.mock('../api/product.api.ts', () => ({
  productApi: {
    createProduct: mocks.createProduct,
    getProductById: mocks.getProductById,
    updateProduct: mocks.updateProduct,
  },
}));

vi.mock('../api/category.api.ts', () => ({
  categoryApi: {
    listCategories: mocks.listCategories,
  },
}));

vi.mock('../api/unit.api.ts', () => ({
  unitApi: {
    listUnits: mocks.listUnits,
  },
}));

vi.mock('../api/api-client.ts', () => ({
  getApiErrorMessage: (error: unknown, fallback = 'error') =>
    error instanceof Error ? error.message : fallback,
}));

const mockCategories: Category[] = [
  {
    id: 1,
    categoryName: 'Groceries',
    tamilName: null,
    displayOrder: 1,
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 2,
    categoryName: 'Spices',
    tamilName: null,
    displayOrder: 2,
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

const mockUnits: UnitOfMeasure[] = [
  {
    id: 1,
    name: 'Kilogram',
    shortName: 'kg',
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Piece',
    shortName: 'pcs',
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Gram',
    shortName: 'g',
    active: false, // inactive unit
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

describe('ProductFormPage Suite — Fast Keyboard Navigation & Entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue([...mockCategories]);
    mocks.listUnits.mockResolvedValue([...mockUnits]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders single compact layout with 13 sequence fields in create mode', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Add New Product')).toBeInTheDocument();

    // Verify all sequence fields are present
    expect(document.getElementById('field-productCode')).toBeInTheDocument();
    expect(document.getElementById('field-productName')).toBeInTheDocument();
    expect(document.getElementById('field-tamilName')).toBeInTheDocument();
    expect(document.getElementById('field-categoryId')).toBeInTheDocument();
    expect(document.getElementById('field-unitId')).toBeInTheDocument();
    expect(document.getElementById('field-barcode')).toBeInTheDocument();
    expect(document.getElementById('field-mrpRate')).toBeInTheDocument();
    expect(document.getElementById('field-normalRate')).toBeInTheDocument();
    expect(document.getElementById('field-retailRate')).toBeInTheDocument();
    expect(document.getElementById('field-functionRate')).toBeInTheDocument();
    expect(document.getElementById('field-originalRate')).toBeInTheDocument();
    expect(document.getElementById('field-openingStock')).toBeInTheDocument();
    expect(document.getElementById('btn-submit')).toBeInTheDocument();
    expect(document.getElementById('btn-save-and-add-another')).toBeInTheDocument();
  });

  it('navigates forward with Enter and backward with Shift+Enter across sequence order 1-13', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const tamilInput = screen.getByLabelText(/Tamil Name/i) as HTMLInputElement;
    const categorySelect = screen.getByLabelText(/Category \*/i) as HTMLSelectElement;

    codeInput.focus();
    expect(document.activeElement).toBe(codeInput);

    // Press Enter on Product Code -> focuses Product Name
    fireEvent.keyDown(codeInput, { key: 'Enter', code: 'Enter' });
    expect(document.activeElement).toBe(nameInput);

    // Press Enter on Product Name -> focuses Tamil Name
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter' });
    expect(document.activeElement).toBe(tamilInput);

    // Press Enter on optional Tamil Name -> focuses Category
    fireEvent.keyDown(tamilInput, { key: 'Enter', code: 'Enter' });
    expect(document.activeElement).toBe(categorySelect);

    // Press Shift+Enter on Category -> moves backward to Tamil Name
    fireEvent.keyDown(categorySelect, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(document.activeElement).toBe(tamilInput);
  });

  it('selects input value on focus for fast numeric replacement', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const mrpInput = (await screen.findByLabelText(/MRP \*/i)) as HTMLInputElement;
    const selectSpy = vi.spyOn(mrpInput, 'select');

    fireEvent.focus(mrpInput);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('supports "Create & Add Another" by creating product, clearing form, and refocusing Product Code', async () => {
    const createdProduct: Product = {
      id: 99,
      productCode: '0012',
      barcode: null,
      productName: 'Ponni Rice',
      tamilName: null,
      categoryId: 1,
      unitId: 1,
      unit: { id: 1, name: 'Kilogram', shortName: 'kg', active: true },
      mrpRate: '65.00',
      normalRate: '60.00',
      originalRate: '50.00',
      retailRate: '62.00',
      functionRate: '61.00',
      currentStock: '100.000',
      active: true,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };
    mocks.createProduct.mockResolvedValue(createdProduct);

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const catSelect = screen.getByLabelText(/Category \*/i) as HTMLSelectElement;
    const unitSelect = screen.getByLabelText(/Unit of Measure \*/i) as HTMLSelectElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: '0012' } });
    fireEvent.change(nameInput, { target: { value: 'Ponni Rice' } });
    fireEvent.change(catSelect, { target: { value: '1' } });
    fireEvent.change(unitSelect, { target: { value: '1' } });
    fireEvent.change(mrpInput, { target: { value: '65.00' } });
    fireEvent.change(normalInput, { target: { value: '60.00' } });

    // Click "Create & Add Another"
    const addAnotherBtn = screen.getByRole('button', { name: /Create & Add Another/i });
    fireEvent.click(addAnotherBtn);

    await waitFor(() => {
      expect(mocks.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: '0012',
          productName: 'Ponni Rice',
          categoryId: 1,
          unitId: 1,
          mrpRate: '65.00',
          normalRate: '60.00',
        })
      );
    });

    // Form inputs should be reset for next entry
    await waitFor(() => {
      expect(codeInput.value).toBe('');
      expect(nameInput.value).toBe('');
    });

    // Success notification should be shown
    expect(await screen.findByText(/created! Ready for next entry/i)).toBeInTheDocument();

    // Focus is returned to Product Code
    expect(document.activeElement).toBe(codeInput);
  });

  it('supports Ctrl+Enter to save product from anywhere in form', async () => {
    const createdProduct: Product = {
      id: 100,
      productCode: '0015',
      barcode: null,
      productName: 'Toor Dal',
      tamilName: null,
      categoryId: 1,
      unitId: 1,
      unit: { id: 1, name: 'Kilogram', shortName: 'kg', active: true },
      mrpRate: '120.00',
      normalRate: '110.00',
      originalRate: '95.00',
      retailRate: '115.00',
      functionRate: '112.00',
      currentStock: '50.000',
      active: true,
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };
    mocks.createProduct.mockResolvedValue(createdProduct);

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const catSelect = screen.getByLabelText(/Category \*/i) as HTMLSelectElement;
    const unitSelect = screen.getByLabelText(/Unit of Measure \*/i) as HTMLSelectElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: '0015' } });
    fireEvent.change(nameInput, { target: { value: 'Toor Dal' } });
    fireEvent.change(catSelect, { target: { value: '1' } });
    fireEvent.change(unitSelect, { target: { value: '1' } });
    fireEvent.change(mrpInput, { target: { value: '120.00' } });
    fireEvent.change(normalInput, { target: { value: '110.00' } });

    // Press Ctrl+Enter from nameInput
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mocks.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: '0015',
          productName: 'Toor Dal',
        })
      );
    });
  });

  it('in edit mode: Opening Stock is omitted and existing inactive unit is preserved with warning badge', async () => {
    const existingProduct: Product = {
      id: 50,
      productCode: '0050',
      barcode: null,
      productName: 'Old Spice',
      tamilName: null,
      categoryId: 2,
      unitId: 3, // Inactive Unit (Gram)
      unit: { id: 3, name: 'Gram', shortName: 'g', active: false },
      mrpRate: '50.00',
      normalRate: '45.00',
      originalRate: '35.00',
      retailRate: '48.00',
      functionRate: '46.00',
      currentStock: '25.000',
      active: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    mocks.getProductById.mockResolvedValue(existingProduct);

    render(
      <MemoryRouter initialEntries={['/admin/products/50/edit']}>
        <Routes>
          <Route path="/admin/products/:id/edit" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Edit Product')).toBeInTheDocument();

    // Opening Stock must NOT be directly editable in Edit mode
    expect(screen.queryByLabelText(/Opening Stock/i)).not.toBeInTheDocument();
    expect(screen.getByText('Stock is changed via Stock In/Out flows, not direct product edit.')).toBeInTheDocument();

    // Inactive unit badge/option is rendered
    expect(screen.getByText(/Current unit is inactive/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Gram \(g\) \(Inactive\)/i })).toBeInTheDocument();
  });

  it('Fix D5: does not advance focus on Enter when IME composition is active (Tamil input)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const tamilInput = (await screen.findByLabelText(/Tamil Name/i)) as HTMLInputElement;
    tamilInput.focus();
    expect(document.activeElement).toBe(tamilInput);

    // 1. Simulate isComposing = true on Enter
    fireEvent.keyDown(tamilInput, {
      key: 'Enter',
      code: 'Enter',
      isComposing: true,
    });
    // Focus should remain on Tamil Name
    expect(document.activeElement).toBe(tamilInput);

    // 2. Simulate keyCode = 229 (IME composition in browsers)
    fireEvent.keyDown(tamilInput, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 229,
      which: 229,
    });
    expect(document.activeElement).toBe(tamilInput);
  });

  it('Fix D6: pristine form allows immediate Escape to navigate back without confirmation', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products" element={<div>Product List Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Add New Product');

    // Press Escape on pristine form
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(await screen.findByText('Product List Screen')).toBeInTheDocument();
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('Fix D6: dirty form prompts confirmation modal on Escape, allowing Stay or Discard', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products" element={<div>Product List Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: '0099' } });

    // Press Escape on dirty form -> modal opens
    fireEvent.keyDown(codeInput, { key: 'Escape', code: 'Escape' });

    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(screen.queryByText('Product List Screen')).not.toBeInTheDocument();

    // Clicking "Stay" closes dialog, keeps entered value intact
    const stayBtn = screen.getByRole('button', { name: /^Stay$/i });
    fireEvent.click(stayBtn);

    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(codeInput.value).toBe('0099');

    // Press Escape again -> modal opens again
    fireEvent.keyDown(codeInput, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();

    // Clicking "Discard" closes dialog and navigates away
    const discardBtn = screen.getByRole('button', { name: /^Discard$/i });
    fireEvent.click(discardBtn);

    expect(await screen.findByText('Product List Screen')).toBeInTheDocument();
  });

  it('Fix D6: Escape is ignored while save is in flight', async () => {
    let resolveSave: ((val: unknown) => void) | undefined;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    mocks.createProduct.mockReturnValue(savePromise);

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products" element={<div>Product List Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: '0099' } });
    fireEvent.change(nameInput, { target: { value: 'Mustard Seeds' } });
    fireEvent.change(mrpInput, { target: { value: '45.00' } });
    fireEvent.change(normalInput, { target: { value: '40.00' } });

    // Trigger save
    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    // During save, press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Neither Discard dialog nor navigation should occur
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(screen.queryByText('Product List Screen')).not.toBeInTheDocument();

    // Clean up promise
    resolveSave!({ id: 1, productName: 'Mustard Seeds' });
  });

  it('Fix D7: validation failure focuses first invalid field and keeps keyboard shortcuts active', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Add New Product');
    const codeInput = document.getElementById('field-productCode') as HTMLInputElement;

    // Submit completely empty required fields
    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    // First invalid field is productCode -> should receive focus
    await waitFor(() => {
      expect(document.activeElement).toBe(codeInput);
    });
    expect(screen.getByText('Product code is required')).toBeInTheDocument();

    // Enter shortcut should work to advance to next field once valid
    fireEvent.change(codeInput, { target: { value: '0088' } });
    const nameInput = document.getElementById('field-productName') as HTMLInputElement;
    fireEvent.keyDown(codeInput, { key: 'Enter', code: 'Enter' });
    expect(document.activeElement).toBe(nameInput);
  });

  it('Fix D7: API 409 conflict focuses Product Code and restores keyboard flow', async () => {
    mocks.createProduct.mockRejectedValue(new Error('Product code already exists'));

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: 'DUPLICATE01' } });
    fireEvent.change(nameInput, { target: { value: 'Sesame Oil' } });
    fireEvent.change(mrpInput, { target: { value: '180.00' } });
    fireEvent.change(normalInput, { target: { value: '170.00' } });

    // Trigger save
    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    // Error appears
    expect(await screen.findByText('Product code already exists')).toBeInTheDocument();

    // Focus is automatically restored to Product Code
    await waitFor(() => {
      expect(document.activeElement).toBe(codeInput);
    });

    // User can edit code and press Ctrl+Enter again without getting blocked
    fireEvent.change(codeInput, { target: { value: 'UNIQUE01' } });
    mocks.createProduct.mockResolvedValueOnce({ id: 101, productName: 'Sesame Oil' });

    fireEvent.keyDown(codeInput, { key: 'Enter', code: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mocks.createProduct).toHaveBeenCalledTimes(2);
    });
  });

  it('Fix D9: synchronous submission lock prevents duplicate API calls on rapid Ctrl+Enter or clicks', async () => {
    let resolveSave: ((val: unknown) => void) | undefined;
    const inFlightPromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    mocks.createProduct.mockReturnValue(inFlightPromise);

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: '0077' } });
    fireEvent.change(nameInput, { target: { value: 'Cardamom' } });
    fireEvent.change(mrpInput, { target: { value: '250.00' } });
    fireEvent.change(normalInput, { target: { value: '230.00' } });

    const submitBtn = screen.getByRole('button', { name: /Create Product/i });

    // First click fires request
    fireEvent.click(submitBtn);
    expect(mocks.createProduct).toHaveBeenCalledTimes(1);

    // Rapid second click while request is still pending
    fireEvent.click(submitBtn);
    // Rapid Ctrl+Enter while request is still pending
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter', ctrlKey: true });

    // Still only 1 call
    expect(mocks.createProduct).toHaveBeenCalledTimes(1);

    // Resolve save
    resolveSave!({ id: 102, productName: 'Cardamom' });
  });

  it('R1 regression: duplicate barcode error focuses Barcode field and preserves form values', async () => {
    mocks.createProduct.mockRejectedValue(new Error('Barcode "8901234567890" already exists'));

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const barcodeInput = (await screen.findByLabelText(/Barcode/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: '0088' } });
    fireEvent.change(barcodeInput, { target: { value: '8901234567890' } });
    fireEvent.change(nameInput, { target: { value: 'Mustard Seeds' } });
    fireEvent.change(mrpInput, { target: { value: '45.00' } });
    fireEvent.change(normalInput, { target: { value: '40.00' } });

    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Barcode "8901234567890" already exists')).toBeInTheDocument();

    // R1: Barcode field must receive focus (NOT Product Code)
    await waitFor(() => {
      expect(document.activeElement).toBe(barcodeInput);
    });

    // Form values must be fully preserved
    expect(codeInput.value).toBe('0088');
    expect(barcodeInput.value).toBe('8901234567890');
    expect(nameInput.value).toBe('Mustard Seeds');
    expect(mrpInput.value).toBe('45.00');
    expect(normalInput.value).toBe('40.00');
  });

  it('R2: generic network/API failure preserves values, releases lock, restores focus, and keyboard shortcuts work immediately', async () => {
    mocks.createProduct.mockRejectedValue(new Error('Network error: Failed to fetch'));

    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products" element={<div>Product List Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;
    const mrpInput = screen.getByLabelText(/MRP \*/i) as HTMLInputElement;
    const normalInput = screen.getByLabelText(/Normal Rate \*/i) as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: '0089' } });
    fireEvent.change(nameInput, { target: { value: 'Cumin Seeds' } });
    fireEvent.change(mrpInput, { target: { value: '85.00' } });
    fireEvent.change(normalInput, { target: { value: '80.00' } });

    const submitBtn = screen.getByRole('button', { name: /Create Product/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Network error: Failed to fetch')).toBeInTheDocument();

    // Form values preserved
    expect(codeInput.value).toBe('0089');
    expect(nameInput.value).toBe('Cumin Seeds');

    // Save lock released
    expect(submitBtn).not.toBeDisabled();

    // Focus restored to Product Code in create mode
    await waitFor(() => {
      expect(document.activeElement).toBe(codeInput);
    });

    // Immediate keyboard usage without mouse click:
    // 1. Enter advances to Product Name
    fireEvent.keyDown(codeInput, { key: 'Enter', code: 'Enter' });
    expect(document.activeElement).toBe(nameInput);

    // 2. Shift+Enter moves back to Product Code
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(document.activeElement).toBe(codeInput);

    // 3. Ctrl+Enter attempts save again immediately without mouse click
    mocks.createProduct.mockResolvedValueOnce({ id: 105, productName: 'Cumin Seeds' });
    fireEvent.keyDown(codeInput, { key: 'Enter', code: 'Enter', ctrlKey: true });
    await waitFor(() => {
      expect(mocks.createProduct).toHaveBeenCalledTimes(2);
    });
  });

  it('R3: Discard modal keyboard safety (initial focus on Stay, traps tab, blocks Ctrl+Enter and hidden Enter, Escape closes, Discard navigates)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/products/new']}>
        <Routes>
          <Route path="/admin/products/new" element={<ProductFormPage />} />
          <Route path="/admin/products" element={<div>Product List Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    const codeInput = (await screen.findByLabelText(/Product Code/i)) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Product Name \*/i) as HTMLInputElement;

    // Type value to make form dirty
    fireEvent.change(codeInput, { target: { value: '0090' } });
    codeInput.focus();
    expect(document.activeElement).toBe(codeInput);

    // Press Escape on dirty form -> modal opens
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    const stayBtn = screen.getByRole('button', { name: /^Stay$/i });
    const discardBtn = screen.getByRole('button', { name: /^Discard$/i });
    const closeBtn = screen.getByRole('button', { name: /Close dialog/i });

    // 1. Initial focus: Stay button
    await waitFor(() => {
      expect(document.activeElement).toBe(stayBtn);
    });

    // 2. Ctrl+Enter while modal open does NOT save
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', ctrlKey: true });
    expect(mocks.createProduct).not.toHaveBeenCalled();

    // 3. Tab navigation wraps within modal actions
    // From Stay -> Discard
    fireEvent.keyDown(stayBtn, { key: 'Tab', code: 'Tab' });
    // From Discard -> Close button
    discardBtn.focus();
    fireEvent.keyDown(discardBtn, { key: 'Tab', code: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab from Close wraps back to Discard
    fireEvent.keyDown(closeBtn, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(discardBtn);

    // Shift+Enter does not move hidden form focus
    stayBtn.focus();
    fireEvent.keyDown(stayBtn, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(document.activeElement).toBe(stayBtn);
    expect(document.activeElement).not.toBe(nameInput);

    // 4. Enter on focused Stay button activates Stay and closes modal without advancing hidden form
    fireEvent.keyDown(stayBtn, { key: 'Enter', code: 'Enter' });
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(screen.queryByText('Product List Screen')).not.toBeInTheDocument();
    // Name input did NOT receive focus
    expect(document.activeElement).not.toBe(nameInput);

    // 5. Escape while modal open closes modal without navigation
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(screen.queryByText('Product List Screen')).not.toBeInTheDocument();

    // 6. Discard still navigates correctly
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();

    const activeDiscardBtn = screen.getByRole('button', { name: /^Discard$/i });
    fireEvent.click(activeDiscardBtn);
    expect(await screen.findByText('Product List Screen')).toBeInTheDocument();
  });
});
