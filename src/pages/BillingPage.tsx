import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { productApi } from '../api/product.api.ts';
import { categoryApi } from '../api/category.api.ts';
import { billingApi } from '../api/billing.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { Product } from '../types/product.types.ts';
import type { Category } from '../types/category.types.ts';
import {
  type RateType,
  type PaymentType,
  type CartItem,
  type SerializedBill,
  type CreateBillInput,
  RATE_TYPES,
  PAYMENT_TYPES,
  getProductRateForType,
} from '../types/billing.types.ts';
import {
  multiplyRateAndQuantity,
  sumAmounts,
  addQuantities,
  incrementQuantity,
  isValidPositiveDecimal,
  formatDisplayCurrency,
  parseToScaledBigInt,
  formatScaledBigInt,
} from '../utils/decimal.ts';

export const BillingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Master Catalog State
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // POS Billing Options
  const [rateType, setRateType] = useState<RateType>('NORMAL');
  const [paymentType, setPaymentType] = useState<PaymentType>('CASH');

  // Barcode Fast Scan State
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [barcodeLoading, setBarcodeLoading] = useState<boolean>(false);
  const [barcodeFeedback, setBarcodeFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Submission & Modal States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedBill, setSavedBill] = useState<SerializedBill | null>(null);

  // Refs for Focus & Debounce
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const barcodeFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Home route based on role
  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/salesman';

  // Helper to show transient barcode feedback banner
  const showBarcodeFeedback = useCallback((type: 'success' | 'error', message: string) => {
    if (barcodeFeedbackTimeoutRef.current) {
      clearTimeout(barcodeFeedbackTimeoutRef.current);
    }
    setBarcodeFeedback({ type, message });
    barcodeFeedbackTimeoutRef.current = setTimeout(() => {
      setBarcodeFeedback(null);
    }, 4000);
  }, []);

  // Load Categories on mount
  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const data = await categoryApi.listCategories();
        if (isMounted) {
          setCategories(data);
        }
      } catch (err: unknown) {
        console.error('Failed to load categories for billing terminal', err);
      } finally {
        if (isMounted) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch products with search query & category filter (for manual search triggering)
  const fetchProducts = useCallback(
    async (query: string, categoryId: number | null) => {
      const requestId = ++activeRequestIdRef.current;
      setProductsLoading(true);

      try {
        let data: Product[];
        const trimmed = query.trim();
        if (trimmed) {
          data = await productApi.searchProducts(trimmed, categoryId ?? undefined);
        } else {
          data = await productApi.listProducts(categoryId ?? undefined);
        }

        if (requestId === activeRequestIdRef.current) {
          setProducts(data);
        }
      } catch (err: unknown) {
        console.error('Failed to fetch products for billing terminal', err);
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setProductsLoading(false);
        }
      }
    },
    []
  );

  // Trigger product load on selected category change
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
        console.error('Failed to load products for category', err);
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

  // Initial focus on barcode input
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Handle Catalog Search Input Change (debounced)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchProducts(val, selectedCategoryId);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    fetchProducts('', selectedCategoryId);
  };

  // Add Product to Cart or Increment Existing
  const handleAddProductToCart = (product: Product) => {
    if (!product.active) {
      showBarcodeFeedback('error', `Product "${product.productName}" is inactive and cannot be billed.`);
      return;
    }

    setSaveError(null);
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product.id);

      if (existingIndex >= 0) {
        // Increment quantity of existing item by 1
        const updated = [...prevCart];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          quantity: incrementQuantity(existing.quantity),
          // Keep current active rates refreshed from catalog
          normalRate: product.normalRate,
          retailRate: product.retailRate,
          functionRate: product.functionRate,
          currentStock: product.currentStock,
        };
        return updated;
      }

      // Add new item with initial quantity = "1"
      const newItem: CartItem = {
        productId: product.id,
        productCode: product.productCode,
        productName: product.productName,
        tamilName: product.tamilName,
        unit: product.unit,
        currentStock: product.currentStock,
        normalRate: product.normalRate,
        retailRate: product.retailRate,
        functionRate: product.functionRate,
        quantity: '1',
        active: product.active,
      };

      return [...prevCart, newItem];
    });

    // Refocus barcode input for continuous POS workflow
    barcodeInputRef.current?.focus();
  };

  // Barcode Scanner Enter Key Handler
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    setBarcodeLoading(true);
    setBarcodeFeedback(null);
    setSaveError(null);

    try {
      const product = await productApi.getProductByBarcode(barcode);
      if (!product) {
        showBarcodeFeedback('error', `Barcode "${barcode}" not found.`);
      } else if (!product.active) {
        showBarcodeFeedback('error', `Product "${product.productName}" is inactive and cannot be billed.`);
      } else {
        handleAddProductToCart(product);
        setBarcodeInput('');
        showBarcodeFeedback('success', `Added "${product.productName}" to cart.`);
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, `Barcode "${barcode}" not found in catalog.`);
      showBarcodeFeedback('error', msg);
    } finally {
      setBarcodeLoading(false);
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }
  };

  // Cart Item Quantity Manual Edit
  const handleUpdateQuantity = (productId: number, newQty: string) => {
    setSaveError(null);
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId) {
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Cart Item Quick Step (+1 / -1)
  const handleStepQuantity = (productId: number, delta: 1 | -1) => {
    setSaveError(null);
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId) {
          if (delta === 1) {
            return { ...item, quantity: incrementQuantity(item.quantity) };
          } else {
            // Decrement quantity by 1, with minimum 1 or exact decimal
            const currentMillis = parseToScaledBigInt(item.quantity || '1', 3);
            const oneMillis = 1000n;
            if (currentMillis > oneMillis) {
              const newMillis = currentMillis - oneMillis;
              const formatted = formatScaledBigInt(newMillis, 3).replace(/\.?0+$/, '') || '1';
              return { ...item, quantity: formatted };
            }
            return item;
          }
        }
        return item;
      })
    );
  };

  // Remove Single Item from Cart
  const handleRemoveCartItem = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
    barcodeInputRef.current?.focus();
  };

  // Clear Entire Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setSaveError(null);
    barcodeInputRef.current?.focus();
  };

  // Calculate Line Item Amounts and Grand Total using Exact Decimal Math
  const lineItemsCalculated = cart.map((item) => {
    const rate = getProductRateForType(item, rateType);
    const amount = isValidPositiveDecimal(item.quantity)
      ? multiplyRateAndQuantity(rate, item.quantity)
      : '0.00';
    return {
      ...item,
      displayRate: rate,
      lineAmount: amount,
      isValidQty: isValidPositiveDecimal(item.quantity),
    };
  });

  const estimatedGrandTotal = sumAmounts(lineItemsCalculated.map((li) => li.lineAmount));
  const hasInvalidItem = lineItemsCalculated.some((li) => !li.isValidQty);
  const totalCartQuantity = lineItemsCalculated.reduce((acc, curr) => {
    return curr.isValidQty ? addQuantities(acc, curr.quantity) : acc;
  }, '0');

  // Submit & Save Bill
  const handleSaveBill = async () => {
    if (cart.length === 0 || isSaving) return;

    if (hasInvalidItem) {
      setSaveError('Please ensure all items have valid positive quantities before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    // Build payload according to exact backend schema
    const payload: CreateBillInput = {
      rateType,
      paymentType,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity.trim(),
      })),
    };

    try {
      const createdBill = await billingApi.createBill(payload);
      // Confirmed success from backend:
      setSavedBill(createdBill);
      // Clear cart only after confirmed 201 success
      setCart([]);
      // Refresh products in background to update stock levels
      fetchProducts(searchQuery, selectedCategoryId);
    } catch (err: unknown) {
      // On failure: cart and entered quantities remain 100% intact!
      const errorMsg = getApiErrorMessage(err, 'Failed to save bill.');
      setSaveError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Start New Bill after Receipt Confirmation
  const handleStartNewBill = () => {
    setSavedBill(null);
    setSaveError(null);
    setBarcodeInput('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Keyboard Shortcuts: Ctrl+Enter (Save Bill), F2 (Focus Barcode)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0 && !isSaving && !savedBill) {
          handleSaveBill();
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'Escape' && savedBill) {
        handleStartNewBill();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="billing-terminal-page">
      {/* Top Header & Fast Options Strip */}
      <div className="billing-top-strip">
        <div className="billing-title-section">
          <div className="terminal-badge">POS TERMINAL</div>
          <h2 className="billing-main-title">Malligai Counter Checkout</h2>
          <span className="billing-user-badge">
            Cashier: <strong>{user?.username}</strong> ({user?.role})
          </span>
        </div>

        <div className="billing-options-group">
          {/* Rate Type Selector */}
          <div className="option-pill-control">
            <label className="option-label">Rate Type:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Rate Type Selector">
              {RATE_TYPES.map((rt) => (
                <button
                  key={rt}
                  type="button"
                  className={`pill-btn ${rateType === rt ? 'pill-btn-active pill-btn-rate' : ''}`}
                  onClick={() => setRateType(rt)}
                  role="radio"
                  aria-checked={rateType === rt}
                  title={`Select ${rt} selling rate tier`}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Type Selector */}
          <div className="option-pill-control">
            <label className="option-label">Payment:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Payment Type Selector">
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={`pill-btn ${paymentType === pt ? 'pill-btn-active pill-btn-payment' : ''}`}
                  onClick={() => setPaymentType(pt)}
                  role="radio"
                  aria-checked={paymentType === pt}
                  title={`Select ${pt} payment method`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigate(homeRoute)}
            title="Return to Dashboard"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {/* Barcode Fast Scanning Bar */}
      <div className="barcode-scan-bar">
        <form onSubmit={handleBarcodeSubmit} className="barcode-scan-form">
          <div className="barcode-input-container">
            <span className="barcode-scanner-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5v14" />
                <path d="M8 5v14" />
                <path d="M12 5v14" />
                <path d="M17 5v14" />
                <path d="M21 5v14" />
              </svg>
            </span>
            <input
              ref={barcodeInputRef}
              type="text"
              className="barcode-input"
              placeholder="Scan Barcode or Type Code & Press Enter (F2)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              disabled={barcodeLoading || isSaving}
              autoComplete="off"
            />
            {barcodeInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setBarcodeInput('');
                  barcodeInputRef.current?.focus();
                }}
                title="Clear barcode input"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-scan-enter"
              disabled={!barcodeInput.trim() || barcodeLoading}
            >
              {barcodeLoading ? <span className="btn-spinner" /> : 'Enter ↵'}
            </button>
          </div>
        </form>

        <div className="barcode-hints">
          <span className="hint-tag"><strong>Enter</strong> = Add item</span>
          <span className="hint-tag"><strong>F2</strong> = Focus scanner</span>
          <span className="hint-tag"><strong>Ctrl+Enter</strong> = Save bill</span>
        </div>
      </div>

      {/* Barcode & Save Alerts */}
      {barcodeFeedback && (
        <div className={`alert ${barcodeFeedback.type === 'success' ? 'alert-success' : 'alert-error'} alert-dismissible`}>
          <span>{barcodeFeedback.message}</span>
          <button type="button" className="modal-close-btn" onClick={() => setBarcodeFeedback(null)}>✕</button>
        </div>
      )}

      {saveError && (
        <div className="alert alert-error alert-dismissible">
          <div className="alert-content-with-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <strong>{saveError}</strong>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setSaveError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main Billing Grid: Left (Categories + Catalog) & Right (Cart) */}
      <div className="billing-layout-grid">
        {/* Left Side: Product Browsing Area */}
        <section className="billing-catalog-section" aria-label="Product Catalog">
          {/* Categories Horizontal Tabs / Sidebar */}
          <div className="billing-category-bar">
            <button
              type="button"
              className={`cat-chip ${selectedCategoryId === null ? 'cat-chip-active' : ''}`}
              onClick={() => setSelectedCategoryId(null)}
            >
              All Products
            </button>
            {categoriesLoading ? (
              <span className="cat-loading-hint">Loading categories...</span>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat-chip ${selectedCategoryId === cat.id ? 'cat-chip-active' : ''} ${!cat.active ? 'cat-chip-inactive' : ''}`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  title={!cat.active ? `${cat.categoryName} (Inactive)` : cat.categoryName}
                >
                  <span>{cat.categoryName}</span>
                  {cat.tamilName && <span className="cat-chip-tamil">({cat.tamilName})</span>}
                  {!cat.active && <span className="category-inactive-tag">Inactive</span>}
                </button>
              ))
            )}
          </div>

          {/* Product Search & Catalog Toolbar */}
          <div className="catalog-toolbar">
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="search-input"
                placeholder={
                  selectedCategoryObj
                    ? `Search in ${selectedCategoryObj.categoryName}...`
                    : 'Search products by name, Tamil name, code...'
                }
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={handleClearSearch} title="Clear search">
                  ✕
                </button>
              )}
            </div>

            <div className="catalog-info-tag">
              {!productsLoading && (
                <span>
                  {products.length} {products.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>
          </div>

          {/* Products Grid / Table */}
          <div className="catalog-table-wrapper">
            {productsLoading ? (
              <div className="table-loading-state">
                <div className="auth-spinner"></div>
                <p>Loading products catalog...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="table-empty-state">
                <p>No products found matching your filter.</p>
                {searchQuery && (
                  <button type="button" className="link-button" onClick={handleClearSearch}>
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <table className="data-table catalog-data-table">
                <thead>
                  <tr>
                    <th className="th-code">Code</th>
                    <th className="th-name">Product Name</th>
                    <th className="th-tamil">Tamil Name</th>
                    <th className="th-unit">Unit</th>
                    <th className="th-rate text-right" title={`Active ${rateType} Rate`}>
                      Rate ({rateType})
                    </th>
                    <th className="th-stock text-right">Stock</th>
                    <th className="th-action text-center">Add</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const activeRate = getProductRateForType(product, rateType);
                    const isCarted = cart.some((it) => it.productId === product.id);

                    return (
                      <tr
                        key={product.id}
                        className={`catalog-row ${!product.active ? 'row-inactive' : 'catalog-row-clickable'} ${isCarted ? 'catalog-row-in-cart' : ''}`}
                        onClick={() => {
                          if (product.active) handleAddProductToCart(product);
                        }}
                      >
                        <td className="td-code font-mono font-semibold">{product.productCode}</td>
                        <td className="td-name font-medium">
                          {product.productName}
                          {!product.active && <span className="category-inactive-tag" style={{ marginLeft: 6 }}>Inactive</span>}
                        </td>
                        <td className="td-tamil tamil-text text-muted">{product.tamilName || '—'}</td>
                        <td className="td-unit">
                          <span className="unit-badge">{product.unit}</span>
                        </td>
                        <td className="td-rate text-right font-mono font-semibold text-primary">
                          ₹{activeRate}
                        </td>
                        <td className="td-stock text-right font-mono">
                          {product.currentStock} <span className="stock-unit">{product.unit}</span>
                        </td>
                        <td className="td-action text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`btn btn-sm ${isCarted ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => handleAddProductToCart(product)}
                            disabled={!product.active}
                            title={product.active ? `Add ${product.productName} to cart` : 'Inactive product cannot be added'}
                          >
                            {isCarted ? '+ Add' : '+ Add'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Right Side: Active Bill Cart Section */}
        <section className="billing-cart-section" aria-label="Current Bill Cart">
          <div className="cart-header">
            <div className="cart-header-title-box">
              <h3 className="cart-title">Bill Cart</h3>
              <span className="cart-count-pill">{cart.length} distinct {cart.length === 1 ? 'item' : 'items'}</span>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline btn-clear-cart"
                onClick={handleClearCart}
                disabled={isSaving}
                title="Clear all cart items"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div className="cart-table-wrapper">
            {cart.length === 0 ? (
              <div className="cart-empty-state">
                <div className="cart-empty-icon" aria-hidden="true">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                </div>
                <h4>Cart is Empty</h4>
                <p>Scan a barcode or click products from the catalog to add items to this bill.</p>
              </div>
            ) : (
              <table className="data-table cart-data-table">
                <thead>
                  <tr>
                    <th className="th-cart-sno">#</th>
                    <th className="th-cart-item">Product</th>
                    <th className="th-cart-rate text-right">Rate</th>
                    <th className="th-cart-qty text-center">Qty</th>
                    <th className="th-cart-amount text-right">Amount</th>
                    <th className="th-cart-remove text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItemsCalculated.map((item, index) => (
                    <tr key={item.productId} className={!item.isValidQty ? 'row-qty-error' : ''}>
                      <td className="td-cart-sno font-mono text-muted">{index + 1}</td>
                      <td className="td-cart-item">
                        <div className="cart-item-name-box">
                          <strong className="cart-item-name">{item.productName}</strong>
                          {item.tamilName && (
                            <span className="cart-item-tamil tamil-text text-muted">{item.tamilName}</span>
                          )}
                          <div className="cart-item-meta">
                            <span className="cart-item-code font-mono">{item.productCode}</span>
                            <span className="cart-stock-hint">
                              Stock: {item.currentStock} {item.unit}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="td-cart-rate text-right font-mono font-semibold">
                        ₹{item.displayRate}
                        <div className="cart-unit-subtext">/{item.unit}</div>
                      </td>
                      <td className="td-cart-qty text-center">
                        <div className="cart-qty-control">
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() => handleStepQuantity(item.productId, -1)}
                            title="Decrease quantity by 1"
                            disabled={isSaving}
                          >
                            -
                          </button>
                          <input
                            type="text"
                            className={`cart-qty-input font-mono ${!item.isValidQty ? 'cart-qty-input-error' : ''}`}
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.productId, e.target.value)}
                            disabled={isSaving}
                            title="Enter quantity (e.g. 1, 2.500)"
                          />
                          <button
                            type="button"
                            className="qty-stepper-btn"
                            onClick={() => handleStepQuantity(item.productId, 1)}
                            title="Increase quantity by 1"
                            disabled={isSaving}
                          >
                            +
                          </button>
                        </div>
                        {!item.isValidQty && (
                          <div className="cart-qty-error-msg">Invalid Qty</div>
                        )}
                      </td>
                      <td className="td-cart-amount text-right font-mono font-bold">
                        ₹{item.lineAmount}
                      </td>
                      <td className="td-cart-remove text-center">
                        <button
                          type="button"
                          className="cart-remove-btn"
                          onClick={() => handleRemoveCartItem(item.productId)}
                          disabled={isSaving}
                          title={`Remove ${item.productName} from cart`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Cart Footer Summary & Save Actions */}
          <div className="cart-footer-panel">
            <div className="cart-summary-row">
              <div className="cart-summary-left">
                <div className="summary-stat">
                  <span className="stat-label">Items:</span>
                  <span className="stat-value font-mono">{cart.length}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Total Qty:</span>
                  <span className="stat-value font-mono">{totalCartQuantity}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Payment:</span>
                  <span className={`badge ${paymentType === 'CASH' ? 'role-admin' : 'role-salesman'}`}>
                    {paymentType}
                  </span>
                </div>
              </div>

              <div className="cart-total-box">
                <span className="total-label">Estimated Total</span>
                <span className="total-amount font-mono">
                  {formatDisplayCurrency(estimatedGrandTotal)}
                </span>
              </div>
            </div>

            <div className="cart-actions-row">
              <button
                type="button"
                className="btn btn-primary btn-save-bill"
                onClick={handleSaveBill}
                disabled={cart.length === 0 || isSaving || hasInvalidItem}
                title="Save bill and generate invoice (Ctrl+Enter)"
              >
                {isSaving ? (
                  <>
                    <span className="btn-spinner" />
                    <span>Processing Bill...</span>
                  </>
                ) : (
                  <>
                    <span>SAVE BILL ↵</span>
                    <span className="key-shortcut-hint">Ctrl+Enter</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Bill Success Receipt Modal */}
      {savedBill && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-receipt-dialog">
            <div className="modal-header receipt-modal-header">
              <div className="receipt-success-banner">
                <div className="receipt-success-icon">✓</div>
                <div>
                  <h3 className="modal-title">Bill Created Successfully</h3>
                  <span className="receipt-subtitle">Invoice has been recorded in database</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleStartNewBill}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body receipt-modal-body">
              {/* Receipt Summary Details */}
              <div className="receipt-meta-grid">
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Bill Number</span>
                  <strong className="receipt-bill-number font-mono">{savedBill.billNumber}</strong>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Date & Time</span>
                  <span className="receipt-meta-val font-mono">
                    {new Date(savedBill.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Rate Applied</span>
                  <span className="badge badge-active">{savedBill.rateType}</span>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Payment Mode</span>
                  <span className="badge role-salesman">{savedBill.paymentType}</span>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Billed By</span>
                  <span className="receipt-meta-val">
                    {savedBill.creator?.username} ({savedBill.creator?.role})
                  </span>
                </div>
                <div className="receipt-meta-item">
                  <span className="receipt-meta-label">Status</span>
                  <span className="status-badge status-active">{savedBill.status}</span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="receipt-items-table-wrapper">
                <table className="data-table receipt-data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedBill.items?.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="font-mono text-muted">{idx + 1}</td>
                        <td>
                          <strong>{item.productName}</strong>
                          <div className="receipt-item-code font-mono text-muted">{item.productCode}</div>
                        </td>
                        <td className="text-center font-mono">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="text-right font-mono">₹{item.rate}</td>
                        <td className="text-right font-mono font-semibold">₹{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Final Totals Summary */}
              <div className="receipt-total-section">
                <div className="receipt-total-row">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{savedBill.subtotal}</span>
                </div>
                <div className="receipt-total-row receipt-grand-total-row">
                  <span>Final Bill Total:</span>
                  <span className="font-mono font-bold receipt-total-amount">
                    ₹{savedBill.totalAmount}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer receipt-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate(homeRoute)}
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                className="btn btn-primary btn-new-bill"
                onClick={handleStartNewBill}
                autoFocus
              >
                + Start New Bill (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

