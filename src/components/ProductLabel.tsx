import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import type { Product } from '../types/product.types.ts';
import type { LabelSize } from '../types/label-settings.types.ts';

export interface CopyReadinessReport {
  revision: number;
  copyIndex: number;
  productCode: string;
  size: LabelSize;
  isValid: boolean;
}

export interface ProductLabelProps {
  product: Product;
  storeName: string;
  packedDate: string; // Formatted MM/YY
  size: LabelSize;
  isPrintCopy?: boolean;
  onBarcodeValidityChange?: (productCode: string, size: LabelSize, isValid: boolean) => void;
  // Print-attempt readiness handshake (used only by printable copies, not the live preview).
  // `printRevision` must be included in the barcode effect's dependency array so that a fresh
  // encode + readiness report is forced on every print attempt, even when productCode/size are
  // unchanged from the previous attempt (e.g. only productName/mrpRate were refreshed).
  printRevision?: number;
  copyIndex?: number;
  onReadinessReport?: (report: CopyReadinessReport) => void;
}

export const ProductLabel: React.FC<ProductLabelProps> = ({
  product,
  storeName,
  packedDate,
  size,
  isPrintCopy = false,
  onBarcodeValidityChange,
  printRevision,
  copyIndex,
  onReadinessReport,
}) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  // Exact productCode string preservation (never convert to Number to preserve leading zeros)
  const exactProductCode = product.productCode != null ? String(product.productCode) : '';
  const displayStoreName = storeName.trim() || 'MALLIGAI';

  useEffect(() => {
    const barcodeElement = barcodeRef.current;
    if (!barcodeElement) return;

    barcodeElement.replaceChildren();
    let isValid = false;

    if (exactProductCode) {
      try {
        JsBarcode(barcodeElement, exactProductCode, {
          format: 'CODE128',
          displayValue: false, // Human-readable product code is rendered separately below barcode
          lineColor: '#000000',
          background: 'transparent',
          // CODE128 quiet zone: roughly 10 narrow-bar modules on each side.
          margin: 1,
          marginLeft: 12,
          marginRight: 12,
          width: 1.15,
          height: 22,
        });
        isValid = barcodeElement.childElementCount > 0;
      } catch {
        barcodeElement.replaceChildren();
      }
    }

    onBarcodeValidityChange?.(exactProductCode, size, isValid);
    if (printRevision != null && copyIndex != null) {
      onReadinessReport?.({ revision: printRevision, copyIndex, productCode: exactProductCode, size, isValid });
    }
  }, [exactProductCode, size, printRevision, copyIndex, onBarcodeValidityChange, onReadinessReport]);

  return (
    <div
      className={`product-label-card label-size-25x25 ${isPrintCopy ? 'printable-label-item' : 'preview-label-item'}`}
      data-testid="product-label"
    >
      <div className="label-store-name">{displayStoreName}</div>

      <div className="label-product-name">{product.productName}</div>

      <div className="label-meta-row">
        <span className="label-pkd font-mono">Pkd: {packedDate}</span>
        <span className="label-mrp font-mono">
          <span className="label-mrp-text">MRP</span>{' '}
          <span className="label-mrp-value">{product.mrpRate}</span>
        </span>
      </div>

      <div className="label-barcode-container">
        <svg ref={barcodeRef} className="label-barcode-svg" />
      </div>

      <div className="label-product-code font-mono font-bold">{exactProductCode}</div>
    </div>
  );
};

export default ProductLabel;
