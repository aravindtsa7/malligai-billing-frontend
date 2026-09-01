import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { Product } from '../types/product.types.ts';
import { ProductLabel } from './ProductLabel.tsx';

const barcodePayloads = vi.hoisted(() => [] as string[]);

vi.mock('jsbarcode', () => ({
  default: (element: SVGSVGElement, value: string) => {
    barcodePayloads.push(value);
    element.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
  },
}));

const product: Product = {
  id: 1,
  productCode: '001211',
  barcode: 'MANUFACTURER-CODE',
  productName: 'English Product Name',
  tamilName: 'தமிழ் பெயர்',
  categoryId: 1,
  unit: 'PIECE',
  mrpRate: '75.00',
  originalRate: '50.00',
  normalRate: '60.00',
  retailRate: '65.00',
  functionRate: '70.00',
  currentStock: '10',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  barcodePayloads.length = 0;
});

describe('ProductLabel compact hardware content', () => {
  it('renders English name, MM/YY, MRP, and exact leading-zero Product Code without Tamil', async () => {
    render(
      <ProductLabel
        product={product}
        storeName="AKILAN TRADERS"
        packedDate="09/26"
        size="LABEL_50X40"
      />,
    );

    const label = screen.getByTestId('product-label');
    expect(label).toHaveTextContent('AKILAN TRADERS');
    expect(label).toHaveTextContent('English Product Name');
    expect(label).not.toHaveTextContent('தமிழ் பெயர்');
    expect(label).toHaveTextContent('Pkd: 09/26');
    expect(label).toHaveTextContent('MRP 75.00');
    expect(label).toHaveTextContent('001211');
    expect(label).not.toHaveTextContent('MANUFACTURER-CODE');

    await waitFor(() => expect(barcodePayloads).toContain('001211'));
  });
});
