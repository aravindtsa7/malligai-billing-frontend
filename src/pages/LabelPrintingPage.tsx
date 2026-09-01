import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { labelSettingsApi } from '../api/label-settings.api.ts';
import { productApi } from '../api/product.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import { formatQuantity } from '../utils/decimal.ts';
import type { LabelSize, LabelSettings } from '../types/label-settings.types.ts';
import type { Product } from '../types/product.types.ts';
import { ProductLabel, type CopyReadinessReport } from '../components/ProductLabel.tsx';
import { createPrintReadinessTracker, type PrintReadinessTracker } from './labelPrintReadiness.ts';
import {
  LABELS_PER_ROW,
  LABEL_COLUMN_GAP_MM,
  LABEL_HEIGHT_MM,
  LABEL_MEDIA_ROW_HEIGHT_MM,
  LABEL_MEDIA_WIDTH_MM,
  LABEL_ROW_GAP_MM,
  LABEL_WIDTH_MM,
  createLabelPrintRows,
  formatPackedMonthYear,
} from './labelPrintLayout.ts';

interface SettingsFormData {
  storeName: string;
  defaultLabelSize: LabelSize;
}

interface BarcodeStatus {
  productCode: string;
  size: LabelSize;
  isValid: boolean;
}

const BARCODE_ERROR_MESSAGE = 'Barcode could not be generated for this Product Code.';
// Existing backend size enum retained only as the readiness-report discriminator.
// Physical geometry is fixed independently at 25mm x 25mm.
const LABEL_HARDWARE_READINESS_SIZE: LabelSize = 'LABEL_50X40';

const getLocalTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const LabelPrintingPage: React.FC = () => {
  // Area A: Settings State
  const [settingsFormData, setSettingsFormData] = useState<SettingsFormData>({
    storeName: '',
    defaultLabelSize: 'LABEL_50X40',
  });
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsErrors, setSettingsErrors] = useState<{ storeName?: string; general?: string }>({});
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);

  // Area B: Print Job Configuration State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [packedDate, setPackedDate] = useState<string>(getLocalTodayDateString());
  const [copies, setCopies] = useState<number>(1);
  const [barcodeStatus, setBarcodeStatus] = useState<BarcodeStatus | null>(null);
  const [packedDateError, setPackedDateError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printRevision, setPrintRevision] = useState<number>(0);
  const printInProgressRef = useRef<boolean>(false);
  const printAttemptCounterRef = useRef<number>(0);
  const readinessTrackerRef = useRef<PrintReadinessTracker | null>(null);
  const [labelPrintRoot] = useState<HTMLDivElement>(() => {
    const root = document.createElement('div');
    root.id = 'label-print-root';
    root.className = 'printable-labels-container';
    root.setAttribute('data-testid', 'printable-labels-container');
    root.setAttribute('aria-label', 'Printable product label rows');
    return root;
  });

  // Product Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Print isolation: the portal is a direct body child, outside the normal application #root.
  useEffect(() => {
    document.body.appendChild(labelPrintRoot);
    document.body.classList.add('label-printing-mode');
    return () => {
      document.body.classList.remove('label-printing-mode');
      labelPrintRoot.remove();
    };
  }, [labelPrintRoot]);

  // Load Initial Settings
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const data: LabelSettings = await labelSettingsApi.getLabelSettings();
        if (isMounted) {
          setSettingsFormData({
            storeName: data.storeName || '',
            defaultLabelSize: data.defaultLabelSize || 'LABEL_50X40',
          });
        }
      } catch (err: unknown) {
        if (isMounted) {
          setSettingsErrors({
            general: getApiErrorMessage(err, 'Failed to load label settings.'),
          });
        }
      } finally {
        if (isMounted) {
          setSettingsLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch / Search Products for Picker
  const fetchProducts = useCallback(async (query: string) => {
    const requestId = ++activeRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);

    try {
      let data: Product[];
      const trimmed = query.trim();
      if (trimmed) {
        data = await productApi.searchProducts(trimmed);
      } else {
        data = await productApi.listProducts();
      }

      if (requestId === activeRequestIdRef.current) {
        setSearchResults(data);
      }
    } catch (err: unknown) {
      if (requestId === activeRequestIdRef.current) {
        setSearchError(getApiErrorMessage(err, 'Failed to search products.'));
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  // Initial Product List on Mount (shares the same latest-request-wins counter as search)
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;

    const loadInitialProducts = async () => {
      try {
        const data = await productApi.listProducts();
        if (requestId === activeRequestIdRef.current) {
          setSearchResults(data);
        }
      } catch (err: unknown) {
        if (requestId === activeRequestIdRef.current) {
          setSearchError(getApiErrorMessage(err, 'Failed to load products.'));
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    loadInitialProducts();
    return () => {
      activeRequestIdRef.current += 1;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchProducts(val);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    fetchProducts('');
  };

  // Area A: Settings Submit Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSettings) return;

    const trimmedStoreName = settingsFormData.storeName.trim();
    if (!trimmedStoreName) {
      setSettingsErrors({ storeName: 'Label store name is required' });
      return;
    }

    if (trimmedStoreName.length > 191) {
      setSettingsErrors({ storeName: 'Label store name must not exceed 191 characters' });
      return;
    }

    setIsSavingSettings(true);
    setSettingsErrors({});
    setSettingsSuccessMessage(null);

    try {
      const updated = await labelSettingsApi.updateLabelSettings({
        storeName: trimmedStoreName,
        defaultLabelSize: settingsFormData.defaultLabelSize,
      });

      setSettingsFormData({
        storeName: updated.storeName,
        defaultLabelSize: updated.defaultLabelSize,
      });
      setSettingsSuccessMessage('Label settings updated successfully!');
    } catch (err: unknown) {
      setSettingsErrors({
        general: getApiErrorMessage(err, 'Failed to update label settings.'),
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Copies Input Change (1 to 100)
  const handleCopiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setCopies(1);
    } else {
      const bounded = Math.max(1, Math.min(100, val));
      setCopies(bounded);
    }
  };

  // Live preview-only status badge. Informational/pre-emptive UX only — NOT the correctness
  // gate for printing (see handleCopyReadiness / handlePrint below, which gate on the actual
  // printable copies instead).
  const handleBarcodeValidityChange = useCallback((productCode: string, size: LabelSize, isValid: boolean) => {
    setBarcodeStatus({ productCode, size, isValid });
  }, []);

  const exactSelectedProductCode = selectedProduct?.productCode != null
    ? String(selectedProduct.productCode)
    : '';
  const isCurrentBarcodeValid = Boolean(
    selectedProduct
    && barcodeStatus?.productCode === exactSelectedProductCode
    && barcodeStatus.size === LABEL_HARDWARE_READINESS_SIZE
    && barcodeStatus.isValid,
  );
  const isCurrentBarcodeInvalid = Boolean(
    selectedProduct
    && barcodeStatus?.productCode === exactSelectedProductCode
    && barcodeStatus.size === LABEL_HARDWARE_READINESS_SIZE
    && !barcodeStatus.isValid,
  );

  // Called by every printable copy (never the preview) once it has generated/validated its
  // barcode for the given `printRevision`. Delegates to the current attempt's tracker, which
  // ignores reports whose revision doesn't match (stale) or whose copyIndex already reported
  // (duplicate) — so a report can never satisfy a newer or already-settled attempt.
  const handleCopyReadiness = useCallback((report: CopyReadinessReport) => {
    readinessTrackerRef.current?.report(report.revision, report.copyIndex, report.isValid);
  }, []);

  const waitForPrintableCopiesReady = (revision: number, expectedCount: number): Promise<boolean> => (
    new Promise<boolean>((resolve) => {
      readinessTrackerRef.current = createPrintReadinessTracker(revision, expectedCount, (allValid) => {
        readinessTrackerRef.current = null;
        resolve(allValid);
      });
    })
  );

  const waitForNextPaint = () => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  // Revalidate Product master data, then deterministically wait for every printable copy
  // (not just the preview) to report a fresh, valid barcode for the refreshed snapshot before
  // printing. A single requestAnimationFrame is used only as a cosmetic settle AFTER that
  // deterministic handshake — never as the proof itself.
  const handlePrint = async () => {
    if (printInProgressRef.current) return;

    if (!selectedProduct || !selectedProduct.active) {
      setPrintError('Select an active product before printing.');
      return;
    }
    if (!packedDate) {
      setPackedDateError('Packed Date is required.');
      setPrintError(null);
      return;
    }
    if (!isCurrentBarcodeValid) {
      setPrintError(BARCODE_ERROR_MESSAGE);
      return;
    }

    printInProgressRef.current = true;
    setIsPrinting(true);
    setPrintError(null);

    try {
      const refreshedProduct = await productApi.getProductById(selectedProduct.id);

      if (!refreshedProduct.active) {
        setSelectedProduct(refreshedProduct);
        setPrintError('This product is now inactive. Labels were not printed.');
        return;
      }

      setSelectedProduct(refreshedProduct);

      // Expected copy count is captured fresh for THIS attempt; controls are disabled while
      // isPrinting so `copies` cannot change mid-flight, but a later attempt always recomputes it.
      const expectedCount = copies;
      const revision = ++printAttemptCounterRef.current;
      setPrintRevision(revision);

      const allCopiesReady = await waitForPrintableCopiesReady(revision, expectedCount);

      if (!allCopiesReady) {
        setPrintError(BARCODE_ERROR_MESSAGE);
        return;
      }

      await waitForNextPaint();
      window.print();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setPrintError('The selected product no longer exists. Labels were not printed.');
      } else {
        setPrintError(getApiErrorMessage(err, 'Unable to verify the selected product. Labels were not printed.'));
      }
    } finally {
      readinessTrackerRef.current = null;
      printInProgressRef.current = false;
      setIsPrinting(false);
    }
  };

  const formattedPackedDate = formatPackedMonthYear(packedDate);

  if (settingsLoading) {
    return (
      <div className="product-form-loading">
        <div className="auth-spinner"></div>
        <p>Loading label configuration...</p>
      </div>
    );
  }

  const printRows = createLabelPrintRows(copies);

  return (
    <>
      <div className="label-printing-page">
      {/* Dynamic scoped hardware profile; values are centralized for physical calibration. */}
      <style>{`
        .label-printing-page,
        #label-print-root {
          --label-width: ${LABEL_WIDTH_MM}mm;
          --label-height: ${LABEL_HEIGHT_MM}mm;
          --labels-per-row: ${LABELS_PER_ROW};
          --label-column-gap: ${LABEL_COLUMN_GAP_MM}mm;
          --label-row-gap: ${LABEL_ROW_GAP_MM}mm;
          --label-media-width: ${LABEL_MEDIA_WIDTH_MM}mm;
          --label-media-row-height: ${LABEL_MEDIA_ROW_HEIGHT_MM}mm;
        }
        @media print {
          @page {
            size: ${LABEL_MEDIA_WIDTH_MM}mm ${LABEL_MEDIA_ROW_HEIGHT_MM}mm;
            margin: 0;
          }
        }
      `}</style>

      {/* Header & Breadcrumbs */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              Admin
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Label Printing</span>
          </div>
          <h2 className="page-title">Product Label Printing</h2>
          <span className="page-subtitle">
            Print four-up 25 × 25 mm thermal product labels for TVSE media
          </span>
        </div>
      </div>

      <div className="label-page-layout-grid">
        {/* =========================================================================
            AREA A: LABEL SETTINGS
            ========================================================================= */}
        <section className="label-settings-section" aria-label="Label Settings">
          <div className="form-card">
            <div className="form-card-header">
              <div className="section-step-badge">A</div>
              <div>
                <h3 className="form-card-title">Label Settings</h3>
                <span className="form-card-desc">
                  Maintain the stored label identity setting
                </span>
              </div>
            </div>

            {settingsSuccessMessage && (
              <div className="alert alert-success alert-dismissible" style={{ marginBottom: 16 }}>
                <div className="alert-content-with-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{settingsSuccessMessage}</span>
                </div>
                <button type="button" className="modal-close-btn" onClick={() => setSettingsSuccessMessage(null)}>✕</button>
              </div>
            )}

            {settingsErrors.general && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <span>{settingsErrors.general}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label htmlFor="labelStoreName">
                  Label Store Name <span className="required-star">*</span>
                </label>
                <input
                  id="labelStoreName"
                  type="text"
                  className={`form-input ${settingsErrors.storeName ? 'input-error' : ''}`}
                  placeholder="e.g. MALLIGAI"
                  value={settingsFormData.storeName}
                  onChange={(e) => {
                    setSettingsFormData((prev) => ({ ...prev, storeName: e.target.value }));
                    if (settingsErrors.storeName) {
                      setSettingsErrors((prev) => ({ ...prev, storeName: undefined }));
                    }
                  }}
                  disabled={isSavingSettings}
                />
                {settingsErrors.storeName && <span className="field-error">{settingsErrors.storeName}</span>}
                <span className="form-help-text">
                  Retained for settings compatibility; omitted from the compact 25 × 25 mm sticker to prioritize barcode readability
                </span>
              </div>

              <div className="form-actions-bar" style={{ marginTop: 0 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-save"
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? (
                    <>
                      <span className="btn-spinner" />
                      <span>Saving Settings...</span>
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* =========================================================================
            AREA B: PRINT LABEL (Product Selection, Parameters, Preview, Print)
            ========================================================================= */}
        <section className="label-print-section" aria-label="Print Product Label">
          <div className="form-card">
            <div className="form-card-header">
              <div className="section-step-badge">B</div>
              <div>
                <h3 className="form-card-title">Print Label</h3>
                <span className="form-card-desc">
                  Select product, customize packed date and copies, view preview, and print
                </span>
              </div>
            </div>

            <div className="label-print-columns">
              {/* Left Column: Product Selection & Print Options */}
              <div className="label-controls-col">
                {/* 1. Product Picker */}
                <div className="picker-container" style={{ marginBottom: 20 }}>
                  <label className="section-subheading">1. Select Product <span className="required-star">*</span></label>
                  
                  {selectedProduct ? (
                    <div className="selected-product-card">
                      <div className="selected-product-header">
                        <div>
                          <span className="badge badge-active">Selected Product</span>
                          <h4 className="selected-product-title">{selectedProduct.productName}</h4>
                          {selectedProduct.tamilName && (
                            <span className="selected-product-tamil tamil-text">{selectedProduct.tamilName}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setSelectedProduct(null);
                            setBarcodeStatus(null);
                            setPrintError(null);
                          }}
                          disabled={isPrinting}
                        >
                          Change Product
                        </button>
                      </div>

                      <div className="selected-product-meta-grid">
                        <div className="meta-box">
                          <span className="meta-label">Product Code</span>
                          <span className="meta-value font-mono font-bold">{selectedProduct.productCode}</span>
                        </div>
                        <div className="meta-box">
                          <span className="meta-label">MRP</span>
                          <span className="meta-value font-mono font-bold">₹{selectedProduct.mrpRate}</span>
                        </div>
                        <div className="meta-box">
                          <span className="meta-label">Current Stock</span>
                          <span className="meta-value font-mono">{formatQuantity(selectedProduct.currentStock)} {selectedProduct.unit}</span>
                        </div>
                        <div className="meta-box">
                          <span className="meta-label">Unit</span>
                          <span className="meta-value">{selectedProduct.unit}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="product-search-picker">
                      <div className="search-box" style={{ marginBottom: 12 }}>
                        <span className="search-icon" aria-hidden="true">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search product by name, Tamil name, code, or barcode..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          autoFocus
                        />
                        {searchQuery && (
                          <button type="button" className="search-clear-btn" onClick={handleClearSearch} title="Clear search">
                            ✕
                          </button>
                        )}
                      </div>

                      {searchError && (
                        <div className="alert alert-error" style={{ marginBottom: 10 }}>
                          <span>{searchError}</span>
                        </div>
                      )}

                      <div className="search-results-table-wrapper">
                        {isSearching ? (
                          <div className="table-loading-state">
                            <div className="auth-spinner"></div>
                            <p>Searching products...</p>
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="table-empty-state" style={{ padding: '20px 0' }}>
                            <p>No products found matching "{searchQuery}".</p>
                          </div>
                        ) : (
                          <table className="data-table label-picker-table">
                            <thead>
                              <tr>
                                <th style={{ width: '20%' }}>Code</th>
                                <th style={{ width: '40%' }}>Product Name</th>
                                <th style={{ width: '20%' }}>MRP</th>
                                <th style={{ width: '20%', textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searchResults.map((prod) => (
                                <tr
                                  key={prod.id}
                                  className={!prod.active ? 'row-inactive' : 'row-clickable'}
                                  onClick={() => {
                                    if (prod.active && !isPrinting) {
                                      setSelectedProduct(prod);
                                      setPrintError(null);
                                    }
                                  }}
                                >
                                  <td className="font-mono font-bold">{prod.productCode}</td>
                                  <td>
                                    <div className="picker-product-name">{prod.productName}</div>
                                    {prod.tamilName && (
                                      <div className="picker-product-tamil tamil-text text-muted">{prod.tamilName}</div>
                                    )}
                                    {!prod.active && <span className="category-inactive-tag">Inactive</span>}
                                  </td>
                                  <td className="font-mono">₹{prod.mrpRate}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${prod.active ? 'btn-primary' : 'btn-disabled'}`}
                                      disabled={!prod.active || isPrinting}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (prod.active) {
                                          setSelectedProduct(prod);
                                          setPrintError(null);
                                        }
                                      }}
                                    >
                                      {prod.active ? 'Select' : 'Inactive'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Print Parameters */}
                <div className="print-parameters-section" style={{ marginBottom: 20 }}>
                  <label className="section-subheading">2. Print Parameters</label>
                  
                  <div className="form-grid">
                    {/* Packed Date */}
                    <div className="form-group">
                      <label htmlFor="packedDate">
                        Packed Date <span className="required-star">*</span>
                      </label>
                      <input
                        id="packedDate"
                        type="date"
                        className={`form-input ${packedDateError ? 'input-error' : ''}`}
                        value={packedDate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPackedDate(value);
                          setPackedDateError(value ? null : 'Packed Date is required.');
                          setPrintError(null);
                        }}
                        required
                        aria-invalid={Boolean(packedDateError)}
                        disabled={isPrinting}
                      />
                      {packedDateError && <span className="field-error">{packedDateError}</span>}
                      <span className="form-help-text">
                        Prints as <strong>{formattedPackedDate || 'MM/YY'}</strong>
                      </span>
                    </div>

                    {/* Copies */}
                    <div className="form-group">
                      <label htmlFor="copiesInput">
                        Copies (1 - 100) <span className="required-star">*</span>
                      </label>
                      <input
                        id="copiesInput"
                        type="number"
                        min="1"
                        max="100"
                        className="form-input font-mono"
                        value={copies}
                        onChange={handleCopiesChange}
                        disabled={isPrinting}
                      />
                      <span className="form-help-text">
                        Number of identical thermal labels to generate
                      </span>
                    </div>
                  </div>

                  <div className="form-help-text" style={{ marginTop: 14 }}>
                    Fixed hardware profile: 25 × 25 mm, four labels per row
                  </div>
                </div>
              </div>

              {/* Right Column: Live Preview & Print Trigger */}
              <div className="label-preview-col">
                <label className="section-subheading">3. Live Preview</label>

                <div className="preview-container-box">
                  {selectedProduct ? (
                    <div className="preview-stage">
                      <div className="preview-label-wrapper">
                        <ProductLabel
                          product={selectedProduct}
                          storeName={settingsFormData.storeName}
                          packedDate={formattedPackedDate}
                          size={LABEL_HARDWARE_READINESS_SIZE}
                          isPrintCopy={false}
                          onBarcodeValidityChange={handleBarcodeValidityChange}
                        />
                      </div>
                      <div className="preview-info-tag">
                        <span className="preview-copies-hint">
                          <strong>{copies}</strong> {copies === 1 ? 'label' : 'labels'} = <strong>{printRows.length}</strong> {printRows.length === 1 ? 'row' : 'rows'} × {LABELS_PER_ROW}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="preview-empty-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
                        <rect x="3" y="7" width="18" height="14" rx="2" />
                        <path d="M7 11h10" />
                        <path d="M7 15h6" />
                      </svg>
                      <p>Select a product to view live label preview</p>
                    </div>
                  )}
                </div>

                <div className="form-help-text label-print-dialog-note">
                  Print dialog: turn Headers and footers OFF
                </div>

                {isCurrentBarcodeInvalid && (
                  <div className="alert alert-error" style={{ marginTop: 12 }} role="alert">
                    <span>{BARCODE_ERROR_MESSAGE}</span>
                  </div>
                )}

                {printError && printError !== BARCODE_ERROR_MESSAGE && (
                  <div className="alert alert-error" style={{ marginTop: 12 }} role="alert">
                    <span>{printError}</span>
                  </div>
                )}

                <div className="print-actions-bar" style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-print-labels-action"
                    disabled={!selectedProduct || !selectedProduct.active || !isCurrentBarcodeValid || isPrinting}
                    onClick={handlePrint}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    <span>{isPrinting ? 'Preparing Labels...' : `Print Labels (${copies})`}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      </div>

      {createPortal(selectedProduct ? (
        <>
          {printRows.map((row, rowIndex) => (
            <div key={rowIndex} className="printable-label-row" data-testid="printable-label-row">
              {row.map((copyIdx, slotIndex) => copyIdx == null ? (
                <div
                  key={`empty-${slotIndex}`}
                  className="empty-label-slot"
                  data-testid="empty-label-slot"
                  aria-hidden="true"
                />
              ) : (
                <div key={copyIdx} className="printable-label-slot">
                  <ProductLabel
                    product={selectedProduct}
                    storeName={settingsFormData.storeName}
                    packedDate={formattedPackedDate}
                    size={LABEL_HARDWARE_READINESS_SIZE}
                    isPrintCopy={true}
                    printRevision={printRevision}
                    copyIndex={copyIdx}
                    onReadinessReport={handleCopyReadiness}
                  />
                </div>
              ))}
            </div>
          ))}
        </>
      ) : null, labelPrintRoot)}
    </>
  );
};

export default LabelPrintingPage;
