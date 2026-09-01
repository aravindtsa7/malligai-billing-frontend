import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { productApi } from '../api/product.api.ts';
import { categoryApi } from '../api/category.api.ts';
import { stockApi } from '../api/stock.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import { formatQuantity } from '../utils/decimal.ts';
import type { Product } from '../types/product.types.ts';
import type { Category } from '../types/category.types.ts';
import type { StockAdjustmentType } from '../types/stock.types.ts';

interface StockInFormData {
  quantity: string;
  note: string;
}

interface StockInFormErrors {
  quantity?: string;
  general?: string;
}

interface StockAdjustmentFormData {
  type: StockAdjustmentType;
  quantity: string;
  note: string;
}

interface StockAdjustmentFormErrors {
  type?: string;
  quantity?: string;
  general?: string;
}

export const StockManagementPage: React.FC = () => {
  const navigate = useNavigate();

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Race condition & debounce refs
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal States
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInForm, setStockInForm] = useState<StockInFormData>({ quantity: '', note: '' });
  const [stockInErrors, setStockInErrors] = useState<StockInFormErrors>({});
  const [isStockInSubmitting, setIsStockInSubmitting] = useState<boolean>(false);

  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState<StockAdjustmentFormData>({
    type: 'ADJUSTMENT_IN',
    quantity: '',
    note: '',
  });
  const [adjustmentErrors, setAdjustmentErrors] = useState<StockAdjustmentFormErrors>({});
  const [isAdjustmentSubmitting, setIsAdjustmentSubmitting] = useState<boolean>(false);

  // Helper to show temporary success message
  const triggerSuccessMessage = (msg: string) => {
    setSuccessMessage(msg);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Modal close handlers
  const handleCloseStockInModal = useCallback(() => {
    if (isStockInSubmitting) return;
    setStockInProduct(null);
    setStockInForm({ quantity: '', note: '' });
    setStockInErrors({});
  }, [isStockInSubmitting]);

  const handleCloseAdjustmentModal = useCallback(() => {
    if (isAdjustmentSubmitting) return;
    setAdjustmentProduct(null);
    setAdjustmentForm({ type: 'ADJUSTMENT_IN', quantity: '', note: '' });
    setAdjustmentErrors({});
  }, [isAdjustmentSubmitting]);

  // Keyboard escape listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (stockInProduct && !isStockInSubmitting) {
          handleCloseStockInModal();
        }
        if (adjustmentProduct && !isAdjustmentSubmitting) {
          handleCloseAdjustmentModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stockInProduct, adjustmentProduct, isStockInSubmitting, isAdjustmentSubmitting, handleCloseStockInModal, handleCloseAdjustmentModal]);

  // Load initial categories on mount
  useEffect(() => {
    let isMounted = true;

    const loadInitialCategories = async () => {
      try {
        const data = await categoryApi.listCategories();
        if (isMounted) {
          setCategories(data);
        }
      } catch (err: unknown) {
        console.error('Failed to load categories', err);
      } finally {
        if (isMounted) {
          setCategoriesLoading(false);
        }
      }
    };

    loadInitialCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch products with search query and category filter
  const fetchProducts = useCallback(
    async (query: string, categoryId: number | null) => {
      const requestId = ++activeRequestIdRef.current;
      setProductsLoading(true);
      setError(null);

      try {
        let data: Product[];
        const trimmedQuery = query.trim();

        if (trimmedQuery) {
          data = await productApi.searchProducts(trimmedQuery, categoryId ?? undefined);
        } else {
          data = await productApi.listProducts(categoryId ?? undefined);
        }

        // Only update state if this is the latest request
        if (requestId === activeRequestIdRef.current) {
          setProducts(data);
        }
      } catch (err: unknown) {
        if (requestId === activeRequestIdRef.current) {
          setError(getApiErrorMessage(err, 'Failed to load products.'));
        }
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setProductsLoading(false);
        }
      }
    },
    []
  );

  // Trigger initial product load and reload when selected category changes
  useEffect(() => {
    let isMounted = true;
    const requestId = ++activeRequestIdRef.current;

    const loadProductsForCategory = async () => {
      try {
        let data: Product[];
        const trimmedQuery = searchQuery.trim();

        if (trimmedQuery) {
          data = await productApi.searchProducts(trimmedQuery, selectedCategoryId ?? undefined);
        } else {
          data = await productApi.listProducts(selectedCategoryId ?? undefined);
        }

        if (isMounted && requestId === activeRequestIdRef.current) {
          setProducts(data);
        }
      } catch (err: unknown) {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setError(getApiErrorMessage(err, 'Failed to load products.'));
        }
      } finally {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setProductsLoading(false);
        }
      }
    };

    loadProductsForCategory();

    return () => {
      isMounted = false;
    };
  }, [selectedCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectCategory = (catId: number | null) => {
    if (selectedCategoryId === catId) return;
    setProductsLoading(true);
    setSelectedCategoryId(catId);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchProducts(value, selectedCategoryId);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    fetchProducts('', selectedCategoryId);
  };

  const handleRefresh = async () => {
    setProductsLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        categoryApi.listCategories(),
        searchQuery.trim()
          ? productApi.searchProducts(searchQuery.trim(), selectedCategoryId ?? undefined)
          : productApi.listProducts(selectedCategoryId ?? undefined),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to refresh stock list.'));
    } finally {
      setProductsLoading(false);
    }
  };

  // =========================================================================
  // Stock In Modal Handlers
  // =========================================================================
  const handleOpenStockInModal = (product: Product) => {
    setStockInProduct(product);
    setStockInForm({ quantity: '', note: '' });
    setStockInErrors({});
    setIsStockInSubmitting(false);
  };

  const handleStockInFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStockInForm((prev) => ({ ...prev, [name]: value }));

    if (stockInErrors[name as keyof StockInFormErrors]) {
      setStockInErrors((prev) => {
        const updated = { ...prev };
        delete updated[name as keyof StockInFormErrors];
        return updated;
      });
    }
  };

  const validateStockInForm = (): boolean => {
    const errors: StockInFormErrors = {};
    const qtyTrimmed = stockInForm.quantity.trim();

    if (!qtyTrimmed) {
      errors.quantity = 'Quantity is required';
    } else {
      const num = Number(qtyTrimmed);
      if (isNaN(num) || num <= 0) {
        errors.quantity = 'Quantity must be a positive number greater than 0';
      }
    }

    setStockInErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInProduct || isStockInSubmitting) return;

    if (!validateStockInForm()) {
      return;
    }

    setIsStockInSubmitting(true);
    setStockInErrors({});

    try {
      const result = await stockApi.stockIn(stockInProduct.id, {
        quantity: stockInForm.quantity.trim(),
        note: stockInForm.note.trim() || undefined,
      });

      // Update the modified product in local state with authoritative backend product
      setProducts((prev) =>
        prev.map((p) => (p.id === result.product.id ? result.product : p))
      );

      triggerSuccessMessage(
        `Stock in recorded successfully for "${result.product.productName}". Added: +${formatQuantity(result.transaction.quantity)} ${result.product.unit} (New Stock: ${formatQuantity(result.product.currentStock)} ${result.product.unit}).`
      );

      setStockInProduct(null);
    } catch (err: unknown) {
      setStockInErrors({
        general: getApiErrorMessage(err, 'Failed to record stock in.'),
      });
    } finally {
      setIsStockInSubmitting(false);
    }
  };

  // =========================================================================
  // Stock Adjustment Modal Handlers
  // =========================================================================
  const handleOpenAdjustmentModal = (product: Product) => {
    setAdjustmentProduct(product);
    setAdjustmentForm({ type: 'ADJUSTMENT_IN', quantity: '', note: '' });
    setAdjustmentErrors({});
    setIsAdjustmentSubmitting(false);
  };

  const handleAdjustmentFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setAdjustmentForm((prev) => ({ ...prev, [name]: value }));

    if (adjustmentErrors[name as keyof StockAdjustmentFormErrors]) {
      setAdjustmentErrors((prev) => {
        const updated = { ...prev };
        delete updated[name as keyof StockAdjustmentFormErrors];
        return updated;
      });
    }
  };

  const handleAdjustmentTypeSelect = (type: StockAdjustmentType) => {
    setAdjustmentForm((prev) => ({ ...prev, type }));
    if (adjustmentErrors.type) {
      setAdjustmentErrors((prev) => {
        const updated = { ...prev };
        delete updated.type;
        return updated;
      });
    }
  };

  const validateAdjustmentForm = (): boolean => {
    const errors: StockAdjustmentFormErrors = {};
    const qtyTrimmed = adjustmentForm.quantity.trim();

    if (!adjustmentForm.type) {
      errors.type = 'Adjustment type is required';
    }

    if (!qtyTrimmed) {
      errors.quantity = 'Quantity is required';
    } else {
      const num = Number(qtyTrimmed);
      if (isNaN(num) || num <= 0) {
        errors.quantity = 'Quantity must be a positive number greater than 0';
      }
    }

    setAdjustmentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentProduct || isAdjustmentSubmitting) return;

    if (!validateAdjustmentForm()) {
      return;
    }

    setIsAdjustmentSubmitting(true);
    setAdjustmentErrors({});

    try {
      const result = await stockApi.stockAdjustment(adjustmentProduct.id, {
        type: adjustmentForm.type,
        quantity: adjustmentForm.quantity.trim(),
        note: adjustmentForm.note.trim() || undefined,
      });

      // Update the modified product in local state with authoritative backend product
      setProducts((prev) =>
        prev.map((p) => (p.id === result.product.id ? result.product : p))
      );

      const sign = result.transaction.type === 'ADJUSTMENT_IN' ? '+' : '-';
      const typeLabel =
        result.transaction.type === 'ADJUSTMENT_IN' ? 'Adjustment In' : 'Adjustment Out';

      triggerSuccessMessage(
        `${typeLabel} recorded successfully for "${result.product.productName}". Adjusted: ${sign}${formatQuantity(result.transaction.quantity)} ${result.product.unit} (New Stock: ${formatQuantity(result.product.currentStock)} ${result.product.unit}).`
      );

      setAdjustmentProduct(null);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to record stock adjustment.');
      // Present clear message if backend rejects due to insufficient stock
      if (msg.toLowerCase().includes('insufficient stock')) {
        setAdjustmentErrors({
          general: 'Adjustment quantity exceeds current stock. Cannot reduce stock below 0.',
        });
      } else {
        setAdjustmentErrors({ general: msg });
      }
    } finally {
      setIsAdjustmentSubmitting(false);
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="stock-management-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              Admin
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Stock Management</span>
          </div>
          <h2 className="page-title">Stock Management</h2>
          <span className="page-subtitle">
            {selectedCategoryObj
              ? `Category: ${selectedCategoryObj.categoryName} ${selectedCategoryObj.tamilName ? `(${selectedCategoryObj.tamilName})` : ''}`
              : 'Track current on-hand inventory levels, record stock-in, and make adjustments'}
          </span>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/admin/products')}
            title="Go to Products Catalog Management"
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
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            Products Master
          </button>
          <button
            type="button"
            className="btn btn-outline btn-refresh"
            onClick={handleRefresh}
            disabled={productsLoading || categoriesLoading}
            title="Refresh stock and category data"
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
        <div className="alert alert-success">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Split Layout: Categories Sidebar + Stock Products Table */}
      <div className="product-split-layout">
        {/* Left Category Selector Sidebar */}
        <aside className="category-sidebar" aria-label="Categories Selector">
          <div className="category-sidebar-header">
            <h3 className="category-sidebar-title">Categories</h3>
            <span className="category-sidebar-count">{categories.length} total</span>
          </div>

          <div className="category-list-nav" role="tablist">
            <button
              type="button"
              className={`category-nav-item ${selectedCategoryId === null ? 'category-nav-item-active' : ''}`}
              onClick={() => handleSelectCategory(null)}
              role="tab"
              aria-selected={selectedCategoryId === null}
            >
              <div className="category-nav-content">
                <span className="category-nav-name">All Products</span>
              </div>
              {selectedCategoryId === null && (
                <span className="category-active-indicator" aria-hidden="true" />
              )}
            </button>

            {categoriesLoading ? (
              <div className="category-sidebar-loading">
                <div className="auth-spinner" style={{ width: '20px', height: '20px' }}></div>
                <span>Loading categories...</span>
              </div>
            ) : categories.length === 0 ? (
              <div className="category-sidebar-empty">
                <p>No categories found.</p>
              </div>
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-nav-item ${isSelected ? 'category-nav-item-active' : ''} ${!cat.active ? 'category-nav-item-inactive' : ''}`}
                    onClick={() => handleSelectCategory(cat.id)}
                    role="tab"
                    aria-selected={isSelected}
                    title={!cat.active ? `${cat.categoryName} (Inactive)` : cat.categoryName}
                  >
                    <div className="category-nav-content">
                      <div className="category-nav-names-row">
                        <span className="category-nav-name">{cat.categoryName}</span>
                        {!cat.active && (
                          <span className="category-inactive-tag">Inactive</span>
                        )}
                      </div>
                      {cat.tamilName && (
                        <span className="category-nav-tamil">{cat.tamilName}</span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="category-active-indicator" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Stock Content Area */}
        <section className="product-table-area">
          <div className="table-toolbar">
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="search-input"
                placeholder={
                  selectedCategoryObj
                    ? `Search stock in ${selectedCategoryObj.categoryName}...`
                    : 'Search by product code, name, Tamil name, or barcode...'
                }
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="toolbar-info">
              {!productsLoading && (
                <span className="count-badge">
                  {products.length} {products.length === 1 ? 'product' : 'products'}
                  {selectedCategoryObj && ` in ${selectedCategoryObj.categoryName}`}
                </span>
              )}
            </div>
          </div>

          <div className="data-table-container">
            {productsLoading ? (
              <div className="table-loading-state">
                <div className="auth-spinner"></div>
                <p>Loading inventory data...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="table-empty-state">
                <div className="empty-icon-box" aria-hidden="true">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <h3>No inventory records found</h3>
                {searchQuery ? (
                  <p>
                    No products match &ldquo;<strong>{searchQuery}</strong>&rdquo;
                    {selectedCategoryObj ? ` in category "${selectedCategoryObj.categoryName}"` : ''}. Try another search or{' '}
                    <button type="button" className="link-button" onClick={handleClearSearch}>
                      clear search
                    </button>
                    .
                  </p>
                ) : selectedCategoryObj ? (
                  <p>
                    No products found in category &ldquo;<strong>{selectedCategoryObj.categoryName}</strong>&rdquo;.
                  </p>
                ) : (
                  <p>
                    No products exist in the catalog yet.{' '}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => navigate('/admin/products/new')}
                    >
                      + Add Product
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <table className="data-table stock-data-table">
                <thead>
                  <tr>
                    <th className="th-code">Code</th>
                    <th className="th-barcode">Barcode</th>
                    <th className="th-name">Product Name</th>
                    <th className="th-tamil">Tamil Name</th>
                    {selectedCategoryId === null && <th className="th-category">Category</th>}
                    <th className="th-unit">Unit</th>
                    <th className="th-stock text-right" style={{ width: '130px' }}>
                      Current Stock
                    </th>
                    <th className="th-status text-center">Status</th>
                    <th className="th-action th-action-sticky text-center" style={{ width: '170px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className={!product.active ? 'row-inactive' : ''}>
                      <td className="td-code font-mono font-semibold">{product.productCode}</td>
                      <td className="td-barcode font-mono text-muted" title={product.barcode || 'No barcode'}>
                        {product.barcode || '—'}
                      </td>
                      <td className="td-name font-medium">{product.productName}</td>
                      <td className="td-tamil tamil-text text-muted">{product.tamilName || '—'}</td>
                      {selectedCategoryId === null && (
                        <td className="td-category">
                          <span className="category-badge">
                            {product.category?.categoryName || '—'}
                            {product.category && !product.category.active && (
                              <span className="badge-inactive-dot" title="Category is inactive"> •</span>
                            )}
                          </span>
                        </td>
                      )}
                      <td className="td-unit">
                        <span className="unit-badge">{product.unit}</span>
                      </td>
                      <td className="td-stock text-right font-mono">
                        <span className="stock-highlight-value">
                          {formatQuantity(product.currentStock)}{' '}
                          <span className="stock-unit">{product.unit}</span>
                        </span>
                      </td>
                      <td className="td-status text-center">
                        <span
                          className={`status-badge ${product.active ? 'status-active' : 'status-inactive'}`}
                        >
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="td-action td-action-sticky text-center">
                        <div className="table-action-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline btn-stock-in"
                            onClick={() => handleOpenStockInModal(product)}
                            title={
                              product.active
                                ? `Record stock arrival for ${product.productName}`
                                : `Product is inactive`
                            }
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Stock In
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline btn-stock-adj"
                            onClick={() => handleOpenAdjustmentModal(product)}
                            title={
                              product.active
                                ? `Adjust stock quantity for ${product.productName}`
                                : `Product is inactive`
                            }
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="3" />
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Adjustment
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* ===================================================================== */}
      {/* Modal: Stock In                                                       */}
      {/* ===================================================================== */}
      {stockInProduct && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-in-modal-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="stock-in-modal-title" className="modal-title">
                Stock In — {stockInProduct.productName}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseStockInModal}
                disabled={isStockInSubmitting}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockInSubmit} noValidate>
              <div className="modal-body">
                {stockInErrors.general && (
                  <div className="alert alert-error">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{stockInErrors.general}</span>
                  </div>
                )}

                {/* Product Summary Header Card */}
                <div className="modal-product-summary">
                  <div className="modal-summary-grid">
                    <div className="modal-summary-item">
                      <span className="modal-summary-label">Product Code</span>
                      <span className="modal-summary-val font-mono font-semibold">
                        {stockInProduct.productCode}
                      </span>
                    </div>
                    <div className="modal-summary-item">
                      <span className="modal-summary-label">Unit of Measure</span>
                      <span className="modal-summary-val">
                        <span className="unit-badge">{stockInProduct.unit}</span>
                      </span>
                    </div>
                    <div className="modal-summary-item modal-summary-stock-item">
                      <span className="modal-summary-label">Current Stock on Hand</span>
                      <span className="modal-summary-stock-val font-mono font-semibold">
                        {formatQuantity(stockInProduct.currentStock)}{' '}
                        <span className="stock-unit">{stockInProduct.unit}</span>
                      </span>
                    </div>
                  </div>
                  {!stockInProduct.active && (
                    <div className="modal-inactive-warning">
                      ⚠️ This product is currently inactive. Stock cannot be added to inactive products.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="stockInQuantity">
                    Quantity to Add ({stockInProduct.unit}) <span className="required-star">*</span>
                  </label>
                  <input
                    id="stockInQuantity"
                    name="quantity"
                    type="text"
                    className={`form-input font-mono ${stockInErrors.quantity ? 'input-error' : ''}`}
                    placeholder="e.g. 10, 25.500, 100"
                    value={stockInForm.quantity}
                    onChange={handleStockInFormChange}
                    disabled={isStockInSubmitting}
                    autoFocus
                  />
                  {stockInErrors.quantity && (
                    <span className="field-error">{stockInErrors.quantity}</span>
                  )}
                  <span className="form-help-text">
                    Positive quantity to add to inventory. Exact decimal string is recorded by backend.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="stockInNote">
                    Note / Reference <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    id="stockInNote"
                    name="note"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Supplier delivery invoice #1042, new batch arrival"
                    value={stockInForm.note}
                    onChange={handleStockInFormChange}
                    disabled={isStockInSubmitting}
                  />
                  <span className="form-help-text">
                    Optional reference note attached to the stock ledger transaction
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCloseStockInModal}
                  disabled={isStockInSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-save"
                  disabled={isStockInSubmitting || !stockInProduct.active}
                >
                  {isStockInSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Recording Stock In...
                    </>
                  ) : (
                    '+ Confirm Stock In'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal: Stock Adjustment                                               */}
      {/* ===================================================================== */}
      {adjustmentProduct && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjustment-modal-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="adjustment-modal-title" className="modal-title">
                Stock Adjustment — {adjustmentProduct.productName}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseAdjustmentModal}
                disabled={isAdjustmentSubmitting}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} noValidate>
              <div className="modal-body">
                {adjustmentErrors.general && (
                  <div className="alert alert-error">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{adjustmentErrors.general}</span>
                  </div>
                )}

                {/* Product Summary Header Card */}
                <div className="modal-product-summary">
                  <div className="modal-summary-grid">
                    <div className="modal-summary-item">
                      <span className="modal-summary-label">Product Code</span>
                      <span className="modal-summary-val font-mono font-semibold">
                        {adjustmentProduct.productCode}
                      </span>
                    </div>
                    <div className="modal-summary-item">
                      <span className="modal-summary-label">Unit of Measure</span>
                      <span className="modal-summary-val">
                        <span className="unit-badge">{adjustmentProduct.unit}</span>
                      </span>
                    </div>
                    <div className="modal-summary-item modal-summary-stock-item">
                      <span className="modal-summary-label">Current Stock on Hand</span>
                      <span className="modal-summary-stock-val font-mono font-semibold">
                        {formatQuantity(adjustmentProduct.currentStock)}{' '}
                        <span className="stock-unit">{adjustmentProduct.unit}</span>
                      </span>
                    </div>
                  </div>
                  {!adjustmentProduct.active && (
                    <div className="modal-inactive-warning">
                      ⚠️ This product is currently inactive. Stock cannot be adjusted for inactive products.
                    </div>
                  )}
                </div>

                {/* Adjustment Type Selector */}
                <div className="form-group">
                  <label>
                    Adjustment Type <span className="required-star">*</span>
                  </label>
                  <div className="adjustment-type-pills" role="radiogroup" aria-label="Adjustment Type">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={adjustmentForm.type === 'ADJUSTMENT_IN'}
                      className={`adj-pill-btn ${adjustmentForm.type === 'ADJUSTMENT_IN' ? 'adj-pill-btn-in-active' : ''}`}
                      onClick={() => handleAdjustmentTypeSelect('ADJUSTMENT_IN')}
                      disabled={isAdjustmentSubmitting}
                    >
                      <span className="adj-pill-icon">＋</span>
                      <div className="adj-pill-text">
                        <strong>Adjustment In</strong>
                        <span className="adj-pill-desc">Increase stock (found item / audit gain)</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={adjustmentForm.type === 'ADJUSTMENT_OUT'}
                      className={`adj-pill-btn ${adjustmentForm.type === 'ADJUSTMENT_OUT' ? 'adj-pill-btn-out-active' : ''}`}
                      onClick={() => handleAdjustmentTypeSelect('ADJUSTMENT_OUT')}
                      disabled={isAdjustmentSubmitting}
                    >
                      <span className="adj-pill-icon">－</span>
                      <div className="adj-pill-text">
                        <strong>Adjustment Out</strong>
                        <span className="adj-pill-desc">Decrease stock (damage / spillage / loss)</span>
                      </div>
                    </button>
                  </div>
                  {adjustmentErrors.type && (
                    <span className="field-error">{adjustmentErrors.type}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="adjustmentQuantity">
                    Adjustment Quantity ({adjustmentProduct.unit}) <span className="required-star">*</span>
                  </label>
                  <input
                    id="adjustmentQuantity"
                    name="quantity"
                    type="text"
                    className={`form-input font-mono ${adjustmentErrors.quantity ? 'input-error' : ''}`}
                    placeholder="e.g. 5, 2.500"
                    value={adjustmentForm.quantity}
                    onChange={handleAdjustmentFormChange}
                    disabled={isAdjustmentSubmitting}
                    autoFocus
                  />
                  {adjustmentErrors.quantity && (
                    <span className="field-error">{adjustmentErrors.quantity}</span>
                  )}
                  <span className="form-help-text">
                    Positive quantity to adjust. For Adjustment Out, quantity cannot exceed current on-hand stock.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="adjustmentNote">
                    Reason / Note <span className="text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    id="adjustmentNote"
                    name="note"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Physical inventory count discrepancy, Bag damaged in transit"
                    value={adjustmentForm.note}
                    onChange={handleAdjustmentFormChange}
                    disabled={isAdjustmentSubmitting}
                  />
                  <span className="form-help-text">
                    Reason documented in stock audit transaction history
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCloseAdjustmentModal}
                  disabled={isAdjustmentSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-save"
                  disabled={isAdjustmentSubmitting || !adjustmentProduct.active}
                >
                  {isAdjustmentSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Recording Adjustment...
                    </>
                  ) : (
                    'Confirm Adjustment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
