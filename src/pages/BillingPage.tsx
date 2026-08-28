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
  isStockAvailable,
  isQuantityWithinStock,
  formatDisplayQuantity,
} from '../utils/decimal.ts';
import {
  PrintableReceipt,
  type PaperSize,
  type ReceiptLanguage,
} from '../components/PrintableReceipt.tsx';

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
  const [lastScannedProductId, setLastScannedProductId] = useState<number | null>(null);

  // Review Cart Modal State
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewSelectedIndex, setReviewSelectedIndex] = useState<number>(0);
  const [reviewEditingProductId, setReviewEditingProductId] = useState<number | null>(null);
  const [reviewTempQty, setReviewTempQty] = useState<string>('');

  // Submission & Modal States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedBill, setSavedBill] = useState<SerializedBill | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    const saved = localStorage.getItem('malligai_receipt_paper_size');
    return saved === '58mm' ? '58mm' : '80mm';
  });
  const [receiptLanguage, setReceiptLanguage] = useState<ReceiptLanguage>('ENGLISH');

  const handlePaperSizeChange = (size: PaperSize) => {
    setPaperSize(size);
    localStorage.setItem('malligai_receipt_paper_size', size);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Refs for Focus & State Synchronization & Barcode Queue
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const reviewQtyInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const barcodeFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartRef = useRef<CartItem[]>(cart);
  const barcodeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reviewEditingProductIdRef = useRef(reviewEditingProductId);

  // Home route based on role
  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/salesman';

  // Normal scanner focus must preserve any in-progress text selection/caret.
  const focusBarcodeInput = useCallback(() => {
    if (savedBill || showReviewModal) return;
    barcodeInputRef.current?.focus();
  }, [savedBill, showReviewModal]);

  // Explicit operator focus (F2) may select existing barcode text for replacement.
  const focusAndSelectBarcodeInput = useCallback(() => {
    barcodeInputRef.current?.focus();
    barcodeInputRef.current?.select();
  }, []);

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

  // Add Product to Cart or Increment Existing (Derives from authoritative latest cartRef)
  const handleAddProductToCart = (product: Product, source: 'barcode' | 'catalog'): boolean => {
    if (!product.active) {
      showBarcodeFeedback('error', `Product "${product.productName}" is inactive and cannot be billed.`);
      return false;
    }

    if (!isStockAvailable(product.currentStock)) {
      showBarcodeFeedback('error', `Product "${product.productName}" is out of stock.`);
      return false;
    }

    const currentCart = cartRef.current;
    const existingIndex = currentCart.findIndex((item) => item.productId === product.id);
    const currentQty = existingIndex >= 0 ? currentCart[existingIndex].quantity : '0';
    const nextQty = incrementQuantity(currentQty);

    if (!isQuantityWithinStock(nextQty, product.currentStock)) {
      showBarcodeFeedback(
        'error',
        `Only ${formatDisplayQuantity(product.currentStock)} ${product.unit} available in stock for "${product.productName}".`
      );
      focusBarcodeInput();
      return false;
    }

    setSaveError(null);
    if (source === 'barcode') {
      setLastScannedProductId(product.id);
    }

    let updatedCart: CartItem[];
    if (existingIndex >= 0) {
      // Increment quantity of existing item by 1
      updatedCart = [...currentCart];
      const existing = updatedCart[existingIndex];
      updatedCart[existingIndex] = {
        ...existing,
        quantity: nextQty,
        // Keep current active rates refreshed from catalog
        normalRate: product.normalRate,
        retailRate: product.retailRate,
        functionRate: product.functionRate,
        currentStock: product.currentStock,
      };
    } else {
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
      updatedCart = [...currentCart, newItem];
    }

    // Synchronously update authoritative ref before dispatching state
    cartRef.current = updatedCart;
    setCart(updatedCart);

    // Refocus barcode input for continuous POS workflow
    focusBarcodeInput();
    return true;
  };

  // Barcode Scanner Enter Key Handler (Sequential FIFO Queue)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showReviewModal || isSaving) return;
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    // Clear input immediately for continuous scanning
    setBarcodeInput('');
    setBarcodeLoading(true);
    setBarcodeFeedback(null);
    setSaveError(null);

    barcodeQueueRef.current = barcodeQueueRef.current
      .then(async () => {
        try {
          const product = await productApi.getProductByBarcode(barcode);
          if (!product) {
            showBarcodeFeedback('error', `Barcode "${barcode}" not found.`);
          } else if (!product.active) {
            showBarcodeFeedback('error', `Product "${product.productName}" is inactive and cannot be billed.`);
          } else if (!isStockAvailable(product.currentStock)) {
            showBarcodeFeedback('error', `Product "${product.productName}" is out of stock.`);
          } else {
            const added = handleAddProductToCart(product, 'barcode');
            if (added) {
              showBarcodeFeedback('success', `Added "${product.productName}" to cart.`);
            }
          }
        } catch (err: unknown) {
          const msg = getApiErrorMessage(err, `Barcode "${barcode}" not found in catalog.`);
          showBarcodeFeedback('error', msg);
        } finally {
          setBarcodeLoading(false);
          focusBarcodeInput();
        }
      })
      .catch((err) => {
        console.error('Barcode queue error:', err);
        setBarcodeLoading(false);
        focusBarcodeInput();
      });
  };

  // F3 Shortcut: Edit Quantity of Last Scanned Cart Item
  const handleF3EditQuantity = useCallback(() => {
    if (savedBill || isSaving) return;
    if (!lastScannedProductId || cartRef.current.length === 0) {
      focusBarcodeInput();
      return;
    }
    const isInCart = cartRef.current.some((item) => item.productId === lastScannedProductId);
    if (!isInCart) {
      focusBarcodeInput();
      return;
    }
    const inputEl = qtyInputRefs.current.get(lastScannedProductId);
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    } else {
      focusBarcodeInput();
    }
  }, [savedBill, isSaving, lastScannedProductId, focusBarcodeInput]);

  // Cart Item Quantity Manual Edit
  const handleUpdateQuantity = (productId: number, newQty: string) => {
    setSaveError(null);
    const updated = cartRef.current.map((item) => {
      if (item.productId === productId) {
        return { ...item, quantity: newQty };
      }
      return item;
    });
    cartRef.current = updated;
    setCart(updated);
  };

  // Cart Item Quick Step (+1 / -1)
  const handleStepQuantity = (productId: number, delta: 1 | -1) => {
    setSaveError(null);
    const currentCart = cartRef.current;
    const target = currentCart.find((item) => item.productId === productId);
    if (!target) return;

    if (delta === 1) {
      const nextQty = incrementQuantity(target.quantity);
      if (!isQuantityWithinStock(nextQty, target.currentStock)) {
        showBarcodeFeedback(
          'error',
          `Only ${formatDisplayQuantity(target.currentStock)} ${target.unit} available in stock for "${target.productName}".`
        );
        return;
      }
      const updated = currentCart.map((item) => {
        if (item.productId === productId) {
          return { ...item, quantity: nextQty };
        }
        return item;
      });
      cartRef.current = updated;
      setCart(updated);
    } else {
      // Decrement quantity by 1, with minimum 1 or exact decimal
      const currentMillis = parseToScaledBigInt(target.quantity || '1', 3);
      const oneMillis = 1000n;
      if (currentMillis > oneMillis) {
        const newMillis = currentMillis - oneMillis;
        const formatted = formatScaledBigInt(newMillis, 3).replace(/\.?0+$/, '') || '1';
        const updated = currentCart.map((item) => {
          if (item.productId === productId) {
            return { ...item, quantity: formatted };
          }
          return item;
        });
        cartRef.current = updated;
        setCart(updated);
      }
    }
  };

  // Start Review Quantity Edit (captures original quantity)
  const handleStartReviewEdit = (productId: number, currentQty: string) => {
    reviewEditingProductIdRef.current = productId;
    setReviewEditingProductId(productId);
    setReviewTempQty(currentQty);
  };

  // Commit Review Quantity Edit (Enter)
  const handleCommitReviewEdit = (productId: number) => {
    const trimmed = reviewTempQty.trim();
    if (trimmed === '') {
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      return;
    }
    const target = cartRef.current.find((it) => it.productId === productId);
    if (!target) {
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      return;
    }

    if (!isValidPositiveDecimal(trimmed)) {
      showBarcodeFeedback('error', 'Please enter a valid positive quantity.');
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      return;
    }

    if (!isQuantityWithinStock(trimmed, target.currentStock)) {
      showBarcodeFeedback(
        'error',
        `Only ${formatDisplayQuantity(target.currentStock)} ${target.unit} available in stock for "${target.productName}".`
      );
      // Reject: leave original cart quantity unchanged
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      return;
    }

    // Within stock -> commit
    handleUpdateQuantity(productId, trimmed);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
  };

  // Cancel Review Quantity Edit (Escape) - Preserves original quantity
  const handleCancelReviewEdit = () => {
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
  };

  // Remove Single Item from Cart
  const handleRemoveCartItem = (productId: number) => {
    const updated = cartRef.current.filter((item) => item.productId !== productId);
    cartRef.current = updated;
    setCart(updated);

    if (updated.length === 0) {
      setShowReviewModal(false);
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
    }
    if (reviewEditingProductId === productId) {
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
    }
    setLastScannedProductId((prev) => (prev === productId ? null : prev));
    if (!showReviewModal) {
      focusBarcodeInput();
    }
  };

  // Clear Entire Cart
  const handleClearCart = () => {
    if (cartRef.current.length === 0) return;
    cartRef.current = [];
    setCart([]);
    setLastScannedProductId(null);
    setShowReviewModal(false);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    setSaveError(null);
    focusBarcodeInput();
  };

  // Toggle & Close Cart Review Modal
  const handleToggleReviewModal = useCallback(() => {
    if (savedBill || isSaving) return;
    if (showReviewModal) {
      setShowReviewModal(false);
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
      return;
    }
    if (cart.length === 0) {
      showBarcodeFeedback('error', 'Cart is empty. Scan items first (F6).');
      barcodeInputRef.current?.focus();
      return;
    }
    setShowReviewModal(true);
    setReviewSelectedIndex(0);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
  }, [savedBill, isSaving, showReviewModal, cart.length, showBarcodeFeedback]);

  const handleCloseReviewModal = useCallback(() => {
    setShowReviewModal(false);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  }, []);

  // Auto-focus review quantity input when entering edit mode
  useEffect(() => {
    if (reviewEditingProductId !== null) {
      reviewQtyInputRef.current?.focus();
      reviewQtyInputRef.current?.select();
    }
  }, [reviewEditingProductId]);

  // Calculate Line Item Amounts and Grand Total using Exact Decimal Math
  const lineItemsCalculated = cart.map((item) => {
    const rate = getProductRateForType(item, rateType);
    const isValidFormat = isValidPositiveDecimal(item.quantity);
    const isWithinStock = isQuantityWithinStock(item.quantity, item.currentStock);
    const isValidQty = isValidFormat && isWithinStock;
    const amount = isValidFormat
      ? multiplyRateAndQuantity(rate, item.quantity)
      : '0.00';
    return {
      ...item,
      displayRate: rate,
      lineAmount: amount,
      isValidQty,
      isExceedingStock: isValidFormat && !isWithinStock,
    };
  });

  const estimatedGrandTotal = sumAmounts(lineItemsCalculated.map((li) => li.lineAmount));
  const hasInvalidItem = lineItemsCalculated.some((li) => !li.isValidQty);
  const totalCartQuantity = lineItemsCalculated.reduce((acc, curr) => {
    return curr.isValidQty ? addQuantities(acc, curr.quantity) : acc;
  }, '0');

  // Submit & Save Bill
  const handleSaveBill = async () => {
    if (reviewEditingProductIdRef.current !== null) {
      setSaveError('Finish quantity edit with Enter, or cancel with Escape, before saving.');
      return;
    }

    const cartSnapshot = cartRef.current;
    if (cartSnapshot.length === 0 || isSaving || savedBill) return;

    const hasInvalidSnapshotItem = cartSnapshot.some(
      (item) => !isValidPositiveDecimal(item.quantity) || !isQuantityWithinStock(item.quantity, item.currentStock)
    );
    if (hasInvalidSnapshotItem) {
      setSaveError('Please ensure all items have valid positive quantities within available stock before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    // Build payload according to exact backend schema
    const payload: CreateBillInput = {
      rateType,
      paymentType,
      items: cartSnapshot.map((item) => ({
        productId: item.productId,
        quantity: item.quantity.trim(),
      })),
    };

    try {
      const createdBill = await billingApi.createBill(payload);
      // Confirmed success from backend:
      setSavedBill(createdBill);
      setShowReviewModal(false);
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      // Clear cart only after confirmed 201 success
      cartRef.current = [];
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
    setLastScannedProductId(null);
    setShowReviewModal(false);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  const showReviewModalRef = useRef(showReviewModal);
  const reviewSelectedIndexRef = useRef(reviewSelectedIndex);
  const handleSaveBillRef = useRef(handleSaveBill);
  const handleStartNewBillRef = useRef(handleStartNewBill);
  const handleF3EditQuantityRef = useRef(handleF3EditQuantity);
  const handleToggleReviewModalRef = useRef(handleToggleReviewModal);
  const handleCloseReviewModalRef = useRef(handleCloseReviewModal);
  const handleRemoveCartItemRef = useRef(handleRemoveCartItem);
  const handleStartReviewEditRef = useRef(handleStartReviewEdit);

  useEffect(() => {
    showReviewModalRef.current = showReviewModal;
    reviewEditingProductIdRef.current = reviewEditingProductId;
    reviewSelectedIndexRef.current = reviewSelectedIndex;
    cartRef.current = cart;
    handleSaveBillRef.current = handleSaveBill;
    handleStartNewBillRef.current = handleStartNewBill;
    handleF3EditQuantityRef.current = handleF3EditQuantity;
    handleToggleReviewModalRef.current = handleToggleReviewModal;
    handleCloseReviewModalRef.current = handleCloseReviewModal;
    handleRemoveCartItemRef.current = handleRemoveCartItem;
    handleStartReviewEditRef.current = handleStartReviewEdit;
  });

  // Keyboard Shortcuts: F2 (Focus Barcode), F3 (Edit Last Item Qty), F4 / Ctrl+Enter (Save Bill), F6 (Review Cart), F8 (Receipt Lang), Escape (Dismiss / New Bill)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isPlainF4 = e.key === 'F4' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      const isPlainF6 = e.key === 'F6' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';

      // F8 Language Toggle (works globally)
      if (e.key === 'F8') {
        e.preventDefault();
        setReceiptLanguage((prev) => (prev === 'ENGLISH' ? 'TAMIL' : 'ENGLISH'));
        return;
      }

      // Review Modal is Active
      if (showReviewModalRef.current) {
        if (isPlainF6 || e.key === 'Escape') {
          e.preventDefault();
          handleCloseReviewModalRef.current();
        } else if (e.key === 'F2') {
          e.preventDefault();
          handleCloseReviewModalRef.current();
        } else if (isPlainF4 || isCtrlEnter) {
          e.preventDefault();
          handleSaveBillRef.current();
        } else if (reviewEditingProductIdRef.current === null) {
          // Row navigation within review table
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setReviewSelectedIndex((prev) => Math.min(prev + 1, cartRef.current.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setReviewSelectedIndex((prev) => Math.max(prev - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const target = cartRef.current[reviewSelectedIndexRef.current];
            if (target) {
              handleStartReviewEditRef.current(target.productId, target.quantity);
            }
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            const target = cartRef.current[reviewSelectedIndexRef.current];
            if (target) {
              handleRemoveCartItemRef.current(target.productId);
              setReviewSelectedIndex((prev) => Math.max(0, Math.min(prev, cartRef.current.length - 1)));
            }
          }
        }
        return;
      }

      // Normal Terminal Screen
      if (e.key === 'F2') {
        e.preventDefault();
        focusAndSelectBarcodeInput();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleF3EditQuantityRef.current();
      } else if (isPlainF4 || isCtrlEnter) {
        e.preventDefault();
        handleSaveBillRef.current();
      } else if (isPlainF6) {
        e.preventDefault();
        handleToggleReviewModalRef.current();
      } else if (e.key === 'Escape') {
        handleStartNewBillRef.current();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [focusAndSelectBarcodeInput]);

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
              disabled={isSaving || showReviewModal}
              autoComplete="off"
            />
            {barcodeInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setBarcodeInput('');
                  focusBarcodeInput();
                }}
                title="Clear barcode input"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-scan-enter"
              disabled={!barcodeInput.trim() || isSaving || showReviewModal}
            >
              {barcodeLoading ? <span className="btn-spinner" /> : 'Enter ↵'}
            </button>
          </div>
        </form>

        <div className="barcode-hints">
          <span className="hint-tag"><strong>Enter</strong> = Add item</span>
          <span className="hint-tag"><strong>F2</strong> = Focus scanner</span>
          <span className="hint-tag"><strong>F3</strong> = Edit last qty</span>
          <span className="hint-tag"><strong>F4 / Ctrl+Enter</strong> = Save bill</span>
          <span className="hint-tag"><strong>F6</strong> = Review cart</span>
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
                    const hasStock = isStockAvailable(product.currentStock);

                    return (
                      <tr
                        key={product.id}
                        className={`catalog-row ${!product.active ? 'row-inactive' : hasStock ? 'catalog-row-clickable' : 'row-out-of-stock'} ${isCarted ? 'catalog-row-in-cart' : ''}`}
                        onClick={() => {
                          if (product.active && hasStock) {
                            handleAddProductToCart(product, 'catalog');
                          } else if (!hasStock) {
                            showBarcodeFeedback('error', `Product "${product.productName}" is out of stock.`);
                          }
                        }}
                      >
                        <td className="td-code font-mono font-semibold">{product.productCode}</td>
                        <td className="td-name font-medium">
                          {product.productName}
                          {!product.active && <span className="category-inactive-tag" style={{ marginLeft: 6 }}>Inactive</span>}
                          {product.active && !hasStock && (
                            <span className="stock-out-tag" style={{ marginLeft: 6 }}>
                              OUT OF STOCK
                            </span>
                          )}
                        </td>
                        <td className="td-tamil tamil-text text-muted">{product.tamilName || '—'}</td>
                        <td className="td-unit">
                          <span className="unit-badge">{product.unit}</span>
                        </td>
                        <td className="td-rate text-right font-mono font-semibold text-primary">
                          ₹{activeRate}
                        </td>
                        <td className="td-stock text-right font-mono">
                          {!hasStock ? (
                            <span className="text-danger font-semibold">0 <span className="stock-unit">{product.unit}</span></span>
                          ) : (
                            <span>{product.currentStock} <span className="stock-unit">{product.unit}</span></span>
                          )}
                        </td>
                        <td className="td-action text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`btn btn-sm ${!hasStock ? 'btn-disabled' : isCarted ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => {
                              if (hasStock) {
                                handleAddProductToCart(product, 'catalog');
                              } else {
                                showBarcodeFeedback('error', `Product "${product.productName}" is out of stock.`);
                              }
                            }}
                            disabled={!product.active || !hasStock}
                            title={
                              !product.active
                                ? 'Inactive product cannot be added'
                                : !hasStock
                                ? 'Product is out of stock'
                                : `Add ${product.productName} to cart`
                            }
                          >
                            {!hasStock ? 'Out of Stock' : isCarted ? '+ Add' : '+ Add'}
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
              <div className="cart-header-btn-group">
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-review-cart"
                  onClick={handleToggleReviewModal}
                  disabled={isSaving}
                  title="Review cart items and quantities (F6)"
                >
                  Review Cart (F6)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-clear-cart"
                  onClick={handleClearCart}
                  disabled={isSaving}
                  title="Clear all cart items"
                >
                  Clear Cart
                </button>
              </div>
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
                    <tr
                      key={item.productId}
                      className={`${!item.isValidQty ? 'row-qty-error' : ''} ${item.productId === lastScannedProductId ? 'row-last-scanned' : ''}`}
                    >
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
                            ref={(el) => {
                              if (el) {
                                qtyInputRefs.current.set(item.productId, el);
                              } else {
                                qtyInputRefs.current.delete(item.productId);
                              }
                            }}
                            type="text"
                            className={`cart-qty-input font-mono ${!item.isValidQty ? 'cart-qty-input-error' : ''}`}
                            value={item.quantity}
                            onFocus={(e) => {
                              e.currentTarget.dataset.originalQty = item.quantity;
                            }}
                            onChange={(e) => handleUpdateQuantity(item.productId, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                const trimmed = item.quantity.trim();
                                if (!isValidPositiveDecimal(trimmed)) {
                                  const prev = e.currentTarget.dataset.originalQty || '1';
                                  handleUpdateQuantity(item.productId, prev);
                                  showBarcodeFeedback('error', 'Please enter a valid positive quantity.');
                                } else if (!isQuantityWithinStock(trimmed, item.currentStock)) {
                                  const prev = e.currentTarget.dataset.originalQty || '1';
                                  handleUpdateQuantity(item.productId, prev);
                                  showBarcodeFeedback(
                                    'error',
                                    `Only ${formatDisplayQuantity(item.currentStock)} ${item.unit} available in stock for "${item.productName}".`
                                  );
                                } else {
                                  e.currentTarget.dataset.originalQty = trimmed;
                                }
                                focusBarcodeInput();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                const prev = e.currentTarget.dataset.originalQty || item.quantity;
                                handleUpdateQuantity(item.productId, prev);
                                focusBarcodeInput();
                              }
                            }}
                            onBlur={(e) => {
                              const trimmed = item.quantity.trim();
                              if (!isValidPositiveDecimal(trimmed) || !isQuantityWithinStock(trimmed, item.currentStock)) {
                                const prev = e.currentTarget.dataset.originalQty || '1';
                                if (isQuantityWithinStock(prev, item.currentStock)) {
                                  handleUpdateQuantity(item.productId, prev);
                                }
                              }
                            }}
                            disabled={isSaving}
                            title="Enter quantity (e.g. 1, 2.500) - Press Enter or Esc to return to scanner"
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
                          <div className="cart-qty-error-msg">
                            {item.isExceedingStock
                              ? `Exceeds stock (${formatDisplayQuantity(item.currentStock)} ${item.unit})`
                              : 'Invalid Qty'}
                          </div>
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
                title="Save bill and generate invoice (F4 / Ctrl+Enter)"
              >
                {isSaving ? (
                   <>
                    <span className="btn-spinner" />
                    <span>Processing Bill...</span>
                  </>
                ) : (
                  <>
                    <span>SAVE BILL ↵</span>
                    <span className="key-shortcut-hint">F4 / Ctrl+Enter</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Cart Review Modal (F6) */}
      {showReviewModal && !savedBill && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Cart Review Modal">
          <div className="modal-dialog modal-review-dialog" tabIndex={-1}>
            <div className="modal-header review-modal-header">
              <div className="review-modal-title-box">
                <div className="terminal-badge">F6 REVIEW</div>
                <h3 className="modal-title">Review Bill Cart</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseReviewModal}
                title="Close review (Esc / F6)"
              >
                ✕
              </button>
            </div>

            {/* Summary Bar */}
            <div className="review-summary-bar">
              <div className="review-summary-stat">
                <span className="stat-label">Unique Items:</span>
                <span className="stat-value font-mono">{cart.length}</span>
              </div>
              <div className="review-summary-stat">
                <span className="stat-label">Total Quantity:</span>
                <span className="stat-value font-mono">{totalCartQuantity}</span>
              </div>
              <div className="review-summary-stat">
                <span className="stat-label">Rate Tier:</span>
                <span className="stat-value">{rateType}</span>
              </div>
              <div className="review-summary-total">
                <span className="stat-label">Estimated Total:</span>
                <span className="stat-value font-mono">{formatDisplayCurrency(estimatedGrandTotal)}</span>
              </div>
            </div>

            {saveError && (
              <div className="alert alert-error" role="alert">
                <strong>{saveError}</strong>
              </div>
            )}

            {/* Review Cart Table */}
            <div className="review-table-container">
              <table className="data-table review-cart-table">
                <thead>
                  <tr>
                    <th className="th-cart-sno">#</th>
                    <th className="th-cart-item">Item Description</th>
                    <th className="th-cart-rate text-right">Rate</th>
                    <th className="th-cart-qty text-center">Qty / Unit</th>
                    <th className="th-cart-amount text-right">Amount</th>
                    <th className="th-cart-remove text-center">✕</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItemsCalculated.map((item, index) => {
                    const isSelected = index === reviewSelectedIndex;
                    const isEditing = item.productId === reviewEditingProductId;
                    return (
                      <tr
                        key={item.productId}
                        className={`review-table-row ${isSelected ? 'review-row-selected' : ''} ${!item.isValidQty ? 'row-qty-error' : ''}`}
                        onClick={() => {
                          setReviewSelectedIndex(index);
                        }}
                      >
                        <td className="td-cart-sno font-mono text-muted">{index + 1}</td>
                        <td className="td-cart-item">
                          <div className="review-item-name-box">
                            <strong className="review-item-title">{item.productName}</strong>
                            {item.tamilName && (
                              <span className="review-item-tamil tamil-text text-muted">{item.tamilName}</span>
                            )}
                            <span className="review-item-code font-mono text-muted">{item.productCode}</span>
                          </div>
                        </td>
                        <td className="td-cart-rate text-right font-mono font-semibold">
                          ₹{item.displayRate}
                        </td>
                        <td className="td-cart-qty text-center">
                          {isEditing ? (
                            <input
                              ref={reviewQtyInputRef}
                              type="text"
                              className="form-input font-mono review-qty-inline-input"
                              value={reviewTempQty}
                              onChange={(e) => setReviewTempQty(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCommitReviewEdit(item.productId);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelReviewEdit();
                                }
                              }}
                              onBlur={() => handleCancelReviewEdit()}
                              title="Enter quantity (Press Enter to commit, Esc to cancel)"
                            />
                          ) : (
                            <div
                              className="review-qty-badge font-mono"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewSelectedIndex(index);
                                handleStartReviewEdit(item.productId, item.quantity);
                              }}
                              title="Click or press Enter to edit quantity"
                            >
                              {item.quantity} {item.unit}
                            </div>
                          )}
                        </td>
                        <td className="td-cart-amount text-right font-mono font-bold">
                          ₹{item.lineAmount}
                        </td>
                        <td className="td-cart-remove text-center">
                          <button
                            type="button"
                            className="cart-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCartItem(item.productId);
                              setReviewSelectedIndex((prev) => Math.max(0, Math.min(prev, cartRef.current.length - 1)));
                            }}
                            title={`Remove ${item.productName} from cart (Delete)`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Review Footer with Shortcuts */}
            <div className="modal-footer review-modal-footer">
              <div className="review-footer-hints">
                <span className="hint-tag"><strong>↑ / ↓</strong> = Navigate</span>
                <span className="hint-tag"><strong>Enter</strong> = Edit Qty</span>
                <span className="hint-tag"><strong>Delete</strong> = Remove</span>
                <span className="hint-tag"><strong>Esc / F6</strong> = Close</span>
              </div>
              <div className="review-footer-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCloseReviewModal}
                >
                  Back to Scanner (Esc)
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-review-save"
                  onClick={handleSaveBill}
                  disabled={cart.length === 0 || isSaving || hasInvalidItem}
                  title="Save bill (F4)"
                >
                  {isSaving ? (
                    <>
                      <span className="btn-spinner" />
                      <span>Processing Bill...</span>
                    </>
                  ) : (
                    <>
                      <span>SAVE BILL ↵</span>
                      <span className="key-shortcut-hint">F4</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div className="receipt-modal-footer-left">
                <div className="receipt-paper-size-picker">
                  <span className="paper-size-label">Paper:</span>
                  <div className="paper-size-buttons" role="radiogroup" aria-label="Receipt Paper Width">
                    <button
                      type="button"
                      className={`btn-paper-size ${paperSize === '80mm' ? 'btn-paper-size-active' : ''}`}
                      onClick={() => handlePaperSizeChange('80mm')}
                      role="radio"
                      aria-checked={paperSize === '80mm'}
                      title="80mm Standard thermal paper"
                    >
                      80mm
                    </button>
                    <button
                      type="button"
                      className={`btn-paper-size ${paperSize === '58mm' ? 'btn-paper-size-active' : ''}`}
                      onClick={() => handlePaperSizeChange('58mm')}
                      role="radio"
                      aria-checked={paperSize === '58mm'}
                      title="58mm Compact thermal paper"
                    >
                      58mm
                    </button>
                  </div>
                </div>

                <div className="receipt-lang-picker">
                  <span className="lang-picker-label">Language:</span>
                  <div className="lang-buttons" role="radiogroup" aria-label="Receipt Language">
                    <button
                      type="button"
                      className={`btn-lang ${receiptLanguage === 'ENGLISH' ? 'btn-lang-active' : ''}`}
                      onClick={() => setReceiptLanguage('ENGLISH')}
                      role="radio"
                      aria-checked={receiptLanguage === 'ENGLISH'}
                      title="Print English Receipt (F8 to toggle)"
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={`btn-lang ${receiptLanguage === 'TAMIL' ? 'btn-lang-active' : ''}`}
                      onClick={() => setReceiptLanguage('TAMIL')}
                      role="radio"
                      aria-checked={receiptLanguage === 'TAMIL'}
                      title="Print Tamil Receipt (F8 to toggle)"
                    >
                      தமிழ்
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-print-receipt"
                  onClick={handlePrintReceipt}
                  title="Print customer receipt (P)"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span>Print Receipt</span>
                </button>
              </div>

              <div className="receipt-modal-footer-right">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate(`/bills/${savedBill.id}`)}
                  title="View authoritative invoice details"
                >
                  View Bill Details →
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate(homeRoute)}
                  title="Return to Dashboard"
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-new-bill"
                  onClick={handleStartNewBill}
                  autoFocus
                  title="Start a new bill (Enter)"
                >
                  + Start New Bill (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authoritative Printable Thermal Receipt Component */}
      <PrintableReceipt bill={savedBill} paperSize={paperSize} language={receiptLanguage} />
    </div>
  );
};

