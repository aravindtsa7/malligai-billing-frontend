import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { productApi } from '../api/product.api.ts';
import { billingApi } from '../api/billing.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { Product } from '../types/product.types.ts';
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
  isStockAvailable,
  isQuantityWithinStock,
  formatQuantity,
} from '../utils/decimal.ts';
import {
  PrintableReceipt,
  type PaperSize,
  type ReceiptLanguage,
} from '../components/PrintableReceipt.tsx';
import axios from 'axios';

const isNotFoundError = (err: unknown): boolean => {
  if (axios.isAxiosError(err)) {
    return err.response?.status === 404;
  }
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { status?: number } }).response;
    return res?.status === 404;
  }
  return false;
};

export const BillingPageV2: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Rate & Payment Options
  const [rateType, setRateType] = useState<RateType>('NORMAL');
  const [paymentType, setPaymentType] = useState<PaymentType>('CASH');

  // Smart Product Entry State
  const [entryValue, setEntryValue] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastAddedProductId, setLastAddedProductId] = useState<number | null>(null);
  const lastAddedProductIdRef = useRef<number | null>(null);

  // Feedback & Saving State
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bill Success & Receipt State
  const [savedBill, setSavedBill] = useState<SerializedBill | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    const saved = localStorage.getItem('malligai_receipt_paper_size');
    return saved === '58mm' ? '58mm' : '77mm';
  });
  const [receiptLanguage, setReceiptLanguage] = useState<ReceiptLanguage>('ENGLISH');

  // Review Modal State (F6)
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewSelectedIndex, setReviewSelectedIndex] = useState<number>(0);
  const [reviewEditingProductId, setReviewEditingProductId] = useState<number | null>(null);
  const [reviewTempQty, setReviewTempQty] = useState<string>('');

  // Refs for State Synchronization, Element Focus & FIFO Scanner Queue
  const entryInputRef = useRef<HTMLInputElement>(null);
  const entryValueRef = useRef<string>('');
  const qtyInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const suggestionsListRef = useRef<HTMLUListElement>(null);
  const suggestionsQueryRef = useRef<string>('');
  const cartRef = useRef<CartItem[]>(cart);
  const barcodeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef<number>(0);

  // Review modal refs & Print guard
  const reviewQtyInputRef = useRef<HTMLInputElement>(null);
  const reviewEditingProductIdRef = useRef<number | null>(null);
  const reviewSelectedIndexRef = useRef<number>(0);
  const isPrintingRef = useRef<boolean>(false);

  // Latest references for global keyboard shortcuts
  const showReviewModalRef = useRef(showReviewModal);
  const savedBillRef = useRef(savedBill);
  const isSavingRef = useRef(isSaving);

  const homeRoute = user?.role === 'ADMIN' ? '/admin' : '/salesman';

  // Synchronize cartRef
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    lastAddedProductIdRef.current = lastAddedProductId;
  }, [lastAddedProductId]);

  useEffect(() => {
    showReviewModalRef.current = showReviewModal;
    savedBillRef.current = savedBill;
    isSavingRef.current = isSaving;
    reviewEditingProductIdRef.current = reviewEditingProductId;
    reviewSelectedIndexRef.current = reviewSelectedIndex;
  }, [showReviewModal, savedBill, isSaving, reviewEditingProductId, reviewSelectedIndex]);

  // Focus helper: Smart Product Entry
  const focusEntryInput = useCallback(() => {
    if (savedBillRef.current || showReviewModalRef.current) return;
    entryInputRef.current?.focus();
  }, []);

  // F2 Focus helper: select text for fast replacement
  const focusAndSelectEntryInput = useCallback(() => {
    if (savedBillRef.current || showReviewModalRef.current) return;
    entryInputRef.current?.focus();
    entryInputRef.current?.select();
  }, []);

  // Initial focus and timer cleanup on unmount
  useEffect(() => {
    focusEntryInput();
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [focusEntryInput]);

  // Transient feedback banner helper
  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ type, message });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 4000);
  }, []);

  // Paper size change handler
  const handlePaperSizeChange = (size: PaperSize) => {
    setPaperSize(size);
    localStorage.setItem('malligai_receipt_paper_size', size);
  };

  // Add Product to Cart or increment existing item (Authoritative FIFO Safe)
  const handleAddProductToCart = useCallback(
    (product: Product): boolean => {
      if (!product.active) {
        showFeedback('error', `Product "${product.productName}" is inactive and cannot be billed.`);
        return false;
      }

      if (!isStockAvailable(product.currentStock)) {
        showFeedback('error', `Product "${product.productName}" is out of stock.`);
        return false;
      }

      const currentCart = cartRef.current;
      const existingIndex = currentCart.findIndex((item) => item.productId === product.id);
      const currentQty = existingIndex >= 0 ? currentCart[existingIndex].quantity : '0';
      const nextQty = incrementQuantity(currentQty);

      if (!isQuantityWithinStock(nextQty, product.currentStock)) {
        showFeedback(
          'error',
          `Only ${formatQuantity(product.currentStock)} ${product.unit} available in stock for "${product.productName}".`
        );
        focusEntryInput();
        return false;
      }

      setSaveError(null);
      setLastAddedProductId(product.id);
      lastAddedProductIdRef.current = product.id;

      let updatedCart: CartItem[];
      if (existingIndex >= 0) {
        updatedCart = [...currentCart];
        const existing = updatedCart[existingIndex];
        updatedCart[existingIndex] = {
          ...existing,
          quantity: nextQty,
          normalRate: product.normalRate,
          retailRate: product.retailRate,
          functionRate: product.functionRate,
          currentStock: product.currentStock,
        };
      } else {
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

      cartRef.current = updatedCart;
      setCart(updatedCart);
      showFeedback('success', `Added "${product.productName}" (Qty: ${nextQty})`);
      focusEntryInput();
      return true;
    },
    [showFeedback, focusEntryInput]
  );

  // Debounced Autocomplete Search (150ms)
  const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (showReviewModalRef.current || isSavingRef.current || savedBillRef.current) {
      return;
    }

    const val = e.target.value;
    entryValueRef.current = val;
    setEntryValue(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = val.trim();
    if (!trimmed) {
      suggestionsQueryRef.current = '';
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const requestId = ++searchRequestIdRef.current;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await productApi.searchProducts(trimmed);
        if (requestId === searchRequestIdRef.current && !showReviewModalRef.current) {
          suggestionsQueryRef.current = trimmed;
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setHighlightedIndex(results.length > 0 ? 0 : -1);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 150);
  };

  // Smart Product Entry Submission (Enter Key Handler with FIFO Scanner Queue)
  const handleEntrySubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    if (savedBillRef.current || isSavingRef.current || showReviewModalRef.current) return;

    const rawValue = (entryValueRef.current || entryInputRef.current?.value || entryValue).trim();
    if (!rawValue) return;

    // A highlighted autocomplete suggestion is valid ONLY when it belongs to the exact current manual entry query
    const isSuggestionCurrent =
      showSuggestions &&
      highlightedIndex >= 0 &&
      suggestions[highlightedIndex] != null &&
      suggestionsQueryRef.current.toLowerCase() === rawValue.toLowerCase();

    const selectedSuggestion = isSuggestionCurrent ? suggestions[highlightedIndex] : null;

    // 1. Immediately clear DOM input, query tracking, refs, and close suggestions
    entryValueRef.current = '';
    if (entryInputRef.current) {
      entryInputRef.current.value = '';
    }
    suggestionsQueryRef.current = '';
    setEntryValue('');
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSaveError(null);

    // 2. Sequential FIFO queue execution
    barcodeQueueRef.current = barcodeQueueRef.current
      .then(async () => {
        let exactProduct: Product | null = null;
        let isControlledNotFound = false;

        try {
          // Supports manufacturer barcode and Product.productCode (retaining leading zeros)
          exactProduct = await productApi.getProductByScanValue(rawValue);
        } catch (err: unknown) {
          if (isNotFoundError(err)) {
            isControlledNotFound = true;
          } else {
            // 401 / 403 / 500 / network / timeout / unexpected errors:
            // show controlled visible error, add NOTHING, do NOT fallback
            const msg = getApiErrorMessage(err, `Error processing scan "${rawValue}".`);
            showFeedback('error', msg);
            return; // FIFO queue continues for next scan, nothing added
          }
        }

        if (exactProduct) {
          // Exact scan lookup succeeded (physical scan or product code)
          handleAddProductToCart(exactProduct);
        } else if (isControlledNotFound && selectedSuggestion) {
          // Controlled 404 + matching current manual suggestion
          handleAddProductToCart(selectedSuggestion);
        } else {
          showFeedback('error', `Product not found for "${rawValue}".`);
        }
      })
      .catch((err) => {
        console.error('Barcode queue error:', err);
      })
      .finally(() => {
        focusEntryInput();
      });
  };

  // Keyboard navigation inside Smart Product Entry
  const handleEntryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Escape') {
      if (entryValue) {
        e.preventDefault();
        setEntryValue('');
        setShowSuggestions(false);
      }
    }
  };

  // Scroll highlighted suggestion into view
  useEffect(() => {
    if (showSuggestions && suggestionsListRef.current && highlightedIndex >= 0) {
      const activeEl = suggestionsListRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, showSuggestions]);

  // Click handler for autocomplete suggestions
  const handleSelectSuggestion = (product: Product) => {
    if (showReviewModalRef.current || isSavingRef.current || savedBillRef.current) return;
    suggestionsQueryRef.current = '';
    setEntryValue('');
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    handleAddProductToCart(product);
    focusEntryInput();
  };

  // F3 Shortcut: Focus and Select Quantity of Last Added or Incremented Cart Item
  const handleF3EditQuantity = useCallback(() => {
    if (savedBillRef.current || isSavingRef.current || showReviewModalRef.current) return;
    const targetId = lastAddedProductIdRef.current ?? lastAddedProductId;
    if (!targetId || cartRef.current.length === 0) {
      focusEntryInput();
      return;
    }
    const isInCart = cartRef.current.some((item) => item.productId === targetId);
    if (!isInCart) {
      focusEntryInput();
      return;
    }
    const inputEl = qtyInputRefs.current.get(targetId);
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    } else {
      focusEntryInput();
    }
  }, [lastAddedProductId, focusEntryInput]);

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

  // Remove Single Item from Cart
  const handleRemoveCartItem = useCallback((productId: number) => {
    const updated = cartRef.current.filter((item) => item.productId !== productId);
    cartRef.current = updated;
    setCart(updated);
    setLastAddedProductId((prev) => {
      const next = prev === productId ? null : prev;
      lastAddedProductIdRef.current = next;
      return next;
    });

    if (updated.length === 0) {
      setShowReviewModal(false);
      showReviewModalRef.current = false;
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
    }
    if (reviewEditingProductIdRef.current === productId) {
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
    }
    if (!showReviewModalRef.current) {
      focusEntryInput();
    }
  }, [focusEntryInput]);

  // Clear Entire Cart
  const handleClearCart = () => {
    if (cartRef.current.length === 0) return;
    cartRef.current = [];
    setCart([]);
    setLastAddedProductId(null);
    lastAddedProductIdRef.current = null;
    setSaveError(null);
    setShowReviewModal(false);
    showReviewModalRef.current = false;
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    focusEntryInput();
  };

  // Review Modal Inline Edit Handlers
  const handleStartReviewEdit = useCallback((productId: number, currentQty: string) => {
    reviewEditingProductIdRef.current = productId;
    setReviewEditingProductId(productId);
    setReviewTempQty(currentQty);
  }, []);

  const handleCommitReviewEdit = useCallback((productId: number) => {
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
      showFeedback('error', 'Please enter a valid positive quantity.');
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      return;
    }

    if (!isQuantityWithinStock(trimmed, target.currentStock)) {
      showFeedback(
        'error',
        `Only ${formatQuantity(target.currentStock)} ${target.unit} available in stock for "${target.productName}".`
      );
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      return;
    }

    handleUpdateQuantity(productId, trimmed);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
  }, [reviewTempQty, showFeedback]);

  const handleCancelReviewEdit = useCallback(() => {
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
  }, []);

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
    const amount = isValidFormat ? multiplyRateAndQuantity(rate, item.quantity) : '0.00';
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
  const handleSaveBill = useCallback(async () => {
    if (reviewEditingProductIdRef.current !== null) {
      setSaveError('Finish quantity edit with Enter, or cancel with Escape, before saving.');
      return;
    }

    const cartSnapshot = cartRef.current;
    if (cartSnapshot.length === 0 || isSavingRef.current || savedBillRef.current) return;

    const hasInvalidSnapshotItem = cartSnapshot.some(
      (item) =>
        !isValidPositiveDecimal(item.quantity) ||
        !isQuantityWithinStock(item.quantity, item.currentStock)
    );
    if (hasInvalidSnapshotItem) {
      setSaveError(
        'Please ensure all items have valid positive quantities within available stock before saving.'
      );
      return;
    }

    setIsSaving(true);
    setSaveError(null);

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
      setSavedBill(createdBill);
      setShowReviewModal(false);
      showReviewModalRef.current = false;
      reviewEditingProductIdRef.current = null;
      setReviewEditingProductId(null);
      setReviewTempQty('');
      cartRef.current = [];
      setCart([]);
      setFeedback(null);
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to save bill.');
      setSaveError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [rateType, paymentType]);

  // Start New Bill after Receipt Confirmation
  const handleStartNewBill = useCallback(() => {
    setSavedBill(null);
    setSaveError(null);
    setEntryValue('');
    setSuggestions([]);
    setShowSuggestions(false);
    setLastAddedProductId(null);
    lastAddedProductIdRef.current = null;
    setShowReviewModal(false);
    showReviewModalRef.current = false;
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    setTimeout(() => {
      focusEntryInput();
    }, 50);
  }, [focusEntryInput]);

  // Authoritative Print Receipt Handler (Reused by Button & F9 Shortcut)
  const handlePrintReceipt = useCallback(() => {
    if (!savedBillRef.current || isPrintingRef.current) return;
    isPrintingRef.current = true;
    try {
      window.print();
    } finally {
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 500);
    }
  }, []);

  // Open and Close Cart Review Modal (F6)
  const handleOpenReviewModal = useCallback(() => {
    if (savedBillRef.current || isSavingRef.current) return;
    if (cartRef.current.length === 0) {
      showFeedback('error', 'Cart is empty. Add items first (F6).');
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setShowSuggestions(false);
    setIsSearching(false);
    setReviewSelectedIndex(0);
    reviewSelectedIndexRef.current = 0;
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    showReviewModalRef.current = true;
    setShowReviewModal(true);
  }, [showFeedback]);

  const handleCloseReviewModal = useCallback(() => {
    showReviewModalRef.current = false;
    setShowReviewModal(false);
    reviewEditingProductIdRef.current = null;
    setReviewEditingProductId(null);
    setReviewTempQty('');
    setTimeout(() => {
      entryInputRef.current?.focus();
    }, 50);
  }, []);

  // Ensure Smart Product Entry usability & focus are safely restored whenever review modal closes
  const prevShowReviewModalRef = useRef(showReviewModal);
  useEffect(() => {
    if (prevShowReviewModalRef.current && !showReviewModal && !savedBill) {
      setTimeout(() => {
        entryInputRef.current?.focus();
      }, 50);
    }
    prevShowReviewModalRef.current = showReviewModal;
  }, [showReviewModal, savedBill]);

  // Keyboard Shortcuts (F2, F3, F4, Ctrl+Enter, F6, F8, F9, Escape)
  const handleSaveBillRef = useRef(handleSaveBill);
  const handleStartNewBillRef = useRef(handleStartNewBill);
  const handleF3EditQuantityRef = useRef(handleF3EditQuantity);
  const handleOpenReviewModalRef = useRef(handleOpenReviewModal);
  const handleCloseReviewModalRef = useRef(handleCloseReviewModal);
  const handleRemoveCartItemRef = useRef(handleRemoveCartItem);
  const handleStartReviewEditRef = useRef(handleStartReviewEdit);
  const handlePrintReceiptRef = useRef(handlePrintReceipt);

  useEffect(() => {
    handleSaveBillRef.current = handleSaveBill;
    handleStartNewBillRef.current = handleStartNewBill;
    handleF3EditQuantityRef.current = handleF3EditQuantity;
    handleOpenReviewModalRef.current = handleOpenReviewModal;
    handleCloseReviewModalRef.current = handleCloseReviewModal;
    handleRemoveCartItemRef.current = handleRemoveCartItem;
    handleStartReviewEditRef.current = handleStartReviewEdit;
    handlePrintReceiptRef.current = handlePrintReceipt;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isPlainF4 = e.key === 'F4' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      const isPlainF6 = e.key === 'F6' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      const isPlainF9 = e.key === 'F9' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';

      // F8 Language Toggle (works globally)
      if (e.key === 'F8') {
        e.preventDefault();
        setReceiptLanguage((prev) => (prev === 'ENGLISH' ? 'TAMIL' : 'ENGLISH'));
        return;
      }

      // F9 Print Receipt (works only after bill save succeeds and authoritative receipt exists)
      if (isPlainF9) {
        e.preventDefault();
        if (e.repeat) return;
        if (savedBillRef.current) {
          handlePrintReceiptRef.current();
        }
        return;
      }

      // If Bill is Saved, Enter or Escape starts a new bill
      if (savedBillRef.current) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          handleStartNewBillRef.current();
        }
        return;
      }

      // Review Modal Shortcuts
      if (showReviewModalRef.current) {
        if (isPlainF6 || e.key === 'Escape') {
          e.preventDefault();
          handleCloseReviewModalRef.current();
        } else if (isPlainF4 || isCtrlEnter) {
          e.preventDefault();
          handleSaveBillRef.current();
        } else if (reviewEditingProductIdRef.current === null) {
          // Row navigation and row removal within review table when not editing quantity
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
          } else if (e.key === 'Delete') {
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

      // Normal POS Terminal Shortcuts
      if (e.key === 'F2') {
        e.preventDefault();
        focusAndSelectEntryInput();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleF3EditQuantityRef.current();
      } else if (isPlainF4 || isCtrlEnter) {
        e.preventDefault();
        handleSaveBillRef.current();
      } else if (isPlainF6) {
        e.preventDefault();
        handleOpenReviewModalRef.current();
      } else if (e.key === 'Escape') {
        if (showSuggestions) {
          e.preventDefault();
          setShowSuggestions(false);
        } else {
          focusEntryInput();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [focusAndSelectEntryInput, focusEntryInput, showFeedback, showSuggestions]);

  return (
    <div className="billing-v2-container">
      {/* Top Header Row: Smart Product Entry + Prominent Total Display */}
      <header className="billing-v2-header">
        <div className="billing-v2-entry-area">
          <div className="billing-v2-input-card">
            <form onSubmit={handleEntrySubmit} className="billing-v2-entry-form">
              <span className="billing-v2-scanner-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5v14" />
                  <path d="M8 5v14" />
                  <path d="M12 5v14" />
                  <path d="M17 5v14" />
                  <path d="M21 5v14" />
                </svg>
              </span>

              <input
                ref={entryInputRef}
                type="text"
                className="billing-v2-entry-input"
                placeholder="Scan barcode or type code / product name..."
                value={entryValue}
                onChange={handleEntryChange}
                onKeyDown={handleEntryKeyDown}
                disabled={isSaving || !!savedBill || showReviewModal}
                autoComplete="off"
                aria-label="Smart Product Entry"
              />

              {entryValue && (
                <button
                  type="button"
                  className="billing-v2-clear-btn"
                  disabled={isSaving || !!savedBill || showReviewModal}
                  onClick={() => {
                    if (isSaving || !!savedBill || showReviewModal) return;
                    setEntryValue('');
                    setShowSuggestions(false);
                    focusEntryInput();
                  }}
                  title="Clear input"
                >
                  ✕
                </button>
              )}

              <button
                type="submit"
                className="btn btn-primary billing-v2-enter-btn"
                disabled={!entryValue.trim() || isSaving || !!savedBill || showReviewModal}
              >
                {isSearching ? <span className="btn-spinner" /> : 'Enter ↵'}
              </button>
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="billing-v2-dropdown-panel" role="listbox">
                <div className="billing-v2-dropdown-header">
                  <span>Product Suggestions ({suggestions.length})</span>
                  <span className="dropdown-hints">↑ / ↓ to navigate • Enter to select</span>
                </div>
                <ul ref={suggestionsListRef} className="billing-v2-dropdown-list">
                  {suggestions.map((product, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    const inStock = isStockAvailable(product.currentStock);
                    const canAdd = product.active && inStock;
                    const displayRate = getProductRateForType(product, rateType);

                    return (
                      <li
                        key={product.id}
                        role="option"
                        aria-selected={isHighlighted}
                        className={`billing-v2-dropdown-item ${isHighlighted ? 'highlighted' : ''} ${!canAdd ? 'disabled' : ''}`}
                        onClick={() => {
                          if (canAdd) {
                            handleSelectSuggestion(product);
                          }
                        }}
                      >
                        <div className="dropdown-item-code font-mono">{product.productCode}</div>
                        <div className="dropdown-item-info">
                          <strong className="dropdown-item-name">{product.productName}</strong>
                          {product.tamilName && (
                            <span className="dropdown-item-tamil font-tamil">{product.tamilName}</span>
                          )}
                        </div>
                        <div className="dropdown-item-meta">
                          <span className="dropdown-item-unit">{product.unit}</span>
                          <span className="dropdown-item-rate font-mono font-semibold">₹{displayRate}</span>
                          <span className={`dropdown-item-stock font-mono ${inStock ? 'in-stock' : 'out-of-stock'}`}>
                            {inStock ? `Stock: ${formatQuantity(product.currentStock)}` : 'Out of Stock'}
                          </span>
                          {!product.active && <span className="dropdown-inactive-badge">Inactive</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Quick keyboard hints row */}
          <div className="billing-v2-shortcuts-bar">
            <span className="v2-hint-chip"><strong>F2</strong> Smart Entry</span>
            <span className="v2-hint-chip"><strong>F3</strong> Edit Last Qty</span>
            <span className="v2-hint-chip"><strong>F4 / Ctrl+Enter</strong> Save Bill</span>
            <span className="v2-hint-chip"><strong>F6</strong> Review</span>
            <span className="v2-hint-chip"><strong>F8</strong> Receipt EN/தமிழ்</span>
            <span className="v2-hint-chip"><strong>F9</strong> Print Receipt</span>
          </div>
        </div>

        {/* Prominent Large Total Display */}
        <div className="billing-v2-total-card" aria-live="polite">
          <div className="v2-total-label">TOTAL AMOUNT</div>
          <div className="v2-total-amount font-mono font-bold">
            {formatDisplayCurrency(estimatedGrandTotal)}
          </div>
          <div className="v2-total-meta">
            <span>{cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
            <span>•</span>
            <span>Qty: {totalCartQuantity}</span>
          </div>
        </div>
      </header>

      {/* Transient Alerts / Error Notifications */}
      {feedback && (
        <div className={`billing-v2-feedback-banner ${feedback.type === 'success' ? 'feedback-success' : 'feedback-error'}`}>
          <span>{feedback.message}</span>
          <button type="button" className="v2-banner-close" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {saveError && (
        <div className="billing-v2-feedback-banner feedback-error">
          <span>{saveError}</span>
          <button type="button" className="v2-banner-close" onClick={() => setSaveError(null)}>✕</button>
        </div>
      )}

      {/* Middle Workspace: Dense Keyboard-Friendly Cart Table */}
      <main className="billing-v2-cart-workspace">
        <div className="billing-v2-table-wrapper">
          <table className="billing-v2-table">
            <thead>
              <tr>
                <th className="th-code">Code</th>
                <th className="th-product">Product</th>
                <th className="th-qty text-center">Qty</th>
                <th className="th-unit text-center">Unit</th>
                <th className="th-rate text-right">Rate</th>
                <th className="th-amount text-right">Amount</th>
                <th className="th-action text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {lineItemsCalculated.length === 0 ? (
                <tr className="v2-empty-cart-row">
                  <td colSpan={7}>
                    <div className="v2-empty-cart-state">
                      <div className="v2-empty-icon">🛒</div>
                      <h3>Terminal Ready for Billing</h3>
                      <p>Scan a barcode or type a product code/name above to begin.</p>
                      <div className="v2-empty-shortcuts">
                        <span>Press <strong>F2</strong> to focus search</span>
                        <span>•</span>
                        <span>Press <strong>F4</strong> to save bill</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                lineItemsCalculated.map((item) => {
                  const isLastAdded = item.productId === lastAddedProductId;
                  return (
                    <tr
                      key={item.productId}
                      className={`billing-v2-row ${isLastAdded ? 'v2-row-last-scanned' : ''} ${!item.isValidQty ? 'v2-row-error' : ''}`}
                    >
                      <td className="td-code font-mono">{item.productCode}</td>
                      <td className="td-product">
                        <span className="v2-product-name font-semibold">{item.productName}</span>
                        {item.tamilName && (
                          <span className="v2-product-tamil font-tamil text-muted"> ({item.tamilName})</span>
                        )}
                        {item.isExceedingStock && (
                          <div className="v2-stock-warning">
                            Exceeds stock ({formatQuantity(item.currentStock)} {item.unit} available)
                          </div>
                        )}
                      </td>
                      <td className="td-qty text-center">
                        <input
                          ref={(el) => {
                            if (el) {
                              qtyInputRefs.current.set(item.productId, el);
                            } else {
                              qtyInputRefs.current.delete(item.productId);
                            }
                          }}
                          type="text"
                          className={`v2-qty-input font-mono ${!item.isValidQty ? 'input-error' : ''}`}
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.productId, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusEntryInput();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              focusEntryInput();
                            }
                          }}
                          aria-label={`Quantity for ${item.productName}`}
                        />
                      </td>
                      <td className="td-unit text-center font-mono text-muted">{item.unit}</td>
                      <td className="td-rate text-right font-mono font-semibold">₹{item.displayRate}</td>
                      <td className="td-amount text-right font-mono font-bold">₹{item.lineAmount}</td>
                      <td className="td-action text-center">
                        <button
                          type="button"
                          className="v2-delete-btn"
                          onClick={() => handleRemoveCartItem(item.productId)}
                          title={`Remove ${item.productName} from cart`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <footer className="billing-v2-footer">
        {/* Left: Rate Tier & Payment Pills */}
        <div className="billing-v2-footer-controls">
          {/* Rate Tier Selector */}
          <div className="v2-option-group">
            <span className="v2-option-label">Rate Tier:</span>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Rate Tier">
              {RATE_TYPES.map((rt) => (
                <button
                  key={rt}
                  type="button"
                  className={`pill-btn ${rateType === rt ? 'pill-btn-active pill-btn-rate' : ''}`}
                  onClick={() => setRateType(rt)}
                  role="radio"
                  aria-checked={rateType === rt}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Type Selector */}
          <div className="v2-option-group">
            <span className="v2-option-label">Payment:</span>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Payment Mode">
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  className={`pill-btn ${paymentType === pt ? 'pill-btn-active pill-btn-payment' : ''}`}
                  onClick={() => setPaymentType(pt)}
                  role="radio"
                  aria-checked={paymentType === pt}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Cart Summary */}
        <div className="billing-v2-footer-summary">
          <span className="v2-summary-chip font-mono">
            <strong>{cart.length}</strong> {cart.length === 1 ? 'line item' : 'line items'}
          </span>
          <span className="v2-summary-chip font-mono">
            Qty: <strong>{totalCartQuantity}</strong>
          </span>
          {cart.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm v2-clear-cart-btn"
              onClick={handleClearCart}
              title="Clear all items from cart"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Right: Save Bill Button & Dashboard Navigation */}
        <div className="billing-v2-footer-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigate(homeRoute)}
            title="Return to Dashboard"
          >
            ← Exit POS
          </button>

          <button
            type="button"
            className="btn btn-primary btn-save-v2"
            onClick={handleSaveBill}
            disabled={cart.length === 0 || isSaving || hasInvalidItem}
            title="Save bill (F4 / Ctrl+Enter)"
          >
            {isSaving ? (
              <>
                <span className="btn-spinner" />
                <span>Saving Bill...</span>
              </>
            ) : (
              <>
                <span className="save-btn-text">SAVE BILL ↵</span>
                <span className="key-shortcut-hint">F4 / Ctrl+Enter</span>
              </>
            )}
          </button>
        </div>
      </footer>

      {/* Review Modal (F6) */}
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

            {saveError && (
              <div className="alert alert-error" role="alert" style={{ margin: '8px 16px 0' }}>
                <span>{saveError}</span>
              </div>
            )}

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
                <span className="stat-label">Total:</span>
                <span className="stat-value font-mono">{formatDisplayCurrency(estimatedGrandTotal)}</span>
              </div>
            </div>

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
                              <span className="review-item-tamil font-tamil text-muted"> ({item.tamilName})</span>
                            )}
                            <span className="review-item-code font-mono text-muted"> [{item.productCode}]</span>
                          </div>
                        </td>
                        <td className="td-cart-rate text-right font-mono font-semibold">₹{item.displayRate}</td>
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
                              aria-label={`Edit quantity for ${item.productName}`}
                            />
                          ) : (
                            <button
                              type="button"
                              className="review-qty-badge font-mono"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewSelectedIndex(index);
                                handleStartReviewEdit(item.productId, item.quantity);
                              }}
                              title="Click or press Enter to edit quantity"
                            >
                              {formatQuantity(item.quantity)} {item.unit}
                            </button>
                          )}
                        </td>
                        <td className="td-cart-amount text-right font-mono font-bold">₹{item.lineAmount}</td>
                        <td className="td-cart-remove text-center">
                          <button
                            type="button"
                            className="cart-remove-btn v2-delete-btn"
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
                  Back to Terminal (Esc)
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveBill}
                  disabled={cart.length === 0 || isSaving || hasInvalidItem}
                >
                  SAVE BILL (F4)
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
                  <span className="receipt-subtitle">Invoice recorded in database</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleStartNewBill}
                title="Close modal (Esc / Enter)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body receipt-modal-body">
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

              {/* Items Breakdown */}
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
                          {formatQuantity(item.quantity)} {item.unit}
                        </td>
                        <td className="text-right font-mono">₹{item.rate}</td>
                        <td className="text-right font-mono font-semibold">₹{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                      className={`btn-paper-size ${paperSize === '77mm' ? 'btn-paper-size-active' : ''}`}
                      onClick={() => handlePaperSizeChange('77mm')}
                    >
                      77mm
                    </button>
                    <button
                      type="button"
                      className={`btn-paper-size ${paperSize === '58mm' ? 'btn-paper-size-active' : ''}`}
                      onClick={() => handlePaperSizeChange('58mm')}
                    >
                      58mm
                    </button>
                  </div>
                </div>

                <div className="receipt-lang-picker">
                  <span className="lang-picker-label">Lang:</span>
                  <div className="lang-buttons" role="radiogroup" aria-label="Receipt Language">
                    <button
                      type="button"
                      className={`btn-lang ${receiptLanguage === 'ENGLISH' ? 'btn-lang-active' : ''}`}
                      onClick={() => setReceiptLanguage('ENGLISH')}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      className={`btn-lang ${receiptLanguage === 'TAMIL' ? 'btn-lang-active' : ''}`}
                      onClick={() => setReceiptLanguage('TAMIL')}
                    >
                      தமிழ்
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-print-receipt"
                  onClick={handlePrintReceipt}
                  title="Print receipt (F9)"
                >
                  Print Receipt (F9)
                </button>
              </div>

              <div className="receipt-modal-footer-right">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate(`/bills/${savedBill.id}`)}
                >
                  View Details →
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-new-bill"
                  onClick={handleStartNewBill}
                  autoFocus
                >
                  + New Bill (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authoritative Printable Thermal Receipt */}
      <PrintableReceipt bill={savedBill} paperSize={paperSize} language={receiptLanguage} />
    </div>
  );
};

export default BillingPageV2;
