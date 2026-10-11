import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { productApi } from '../api/product.api.ts';
import { categoryApi } from '../api/category.api.ts';
import { unitApi } from '../api/unit.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import { formatQuantity } from '../utils/decimal.ts';
import type { Category } from '../types/category.types.ts';
import type { UnitOfMeasure } from '../types/unit.types.ts';
import type { CreateProductInput, UpdateProductInput } from '../types/product.types.ts';

interface FormData {
  productCode: string;
  barcode: string;
  productName: string;
  tamilName: string;
  categoryId: string;
  unitId: string;
  mrpRate: string;
  originalRate: string;
  normalRate: string;
  retailRate: string;
  functionRate: string;
  openingStock: string;
  currentStock: string;
  active: boolean;
}

interface FormErrors {
  productCode?: string;
  productName?: string;
  categoryId?: string;
  unitId?: string;
  mrpRate?: string;
  originalRate?: string;
  normalRate?: string;
  retailRate?: string;
  functionRate?: string;
  openingStock?: string;
  general?: string;
}

export const ProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const productId = id ? parseInt(id, 10) : null;

  const [formData, setFormData] = useState<FormData>({
    productCode: '',
    barcode: '',
    productName: '',
    tamilName: '',
    categoryId: '',
    unitId: '',
    mrpRate: '',
    originalRate: '',
    normalRate: '',
    retailRate: '',
    functionRate: '',
    openingStock: '0.000',
    currentStock: '0.000',
    active: true,
  });

  // Tracking for Fix D6 (Unsaved changes / Escape safety), Fix D9 (Synchronous submit lock), and R3 (Discard Modal Focus Safety)
  const isSavingRef = useRef<boolean>(false);
  const [initialFormData, setInitialFormData] = useState<FormData | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const stayBtnRef = useRef<HTMLButtonElement | null>(null);
  const discardBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (showDiscardConfirm) {
      const timer = setTimeout(() => {
        stayBtnRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showDiscardConfirm]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [originalCategoryId, setOriginalCategoryId] = useState<number | null>(null);
  const [productCategoryRef, setProductCategoryRef] = useState<Category | null>(null);

  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [originalUnitId, setOriginalUnitId] = useState<number | null>(null);
  const [productUnitRef, setProductUnitRef] = useState<UnitOfMeasure | null>(null);

  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isInvalidId = isEditMode && (!productId || isNaN(productId) || productId <= 0);

  // Field sequence for keyboard navigation
  const fieldSequence = useMemo(() => {
    const list = [
      'field-productCode',
      'field-productName',
      'field-tamilName',
      'field-categoryId',
      'field-unitId',
      'field-barcode',
      'field-mrpRate',
      'field-normalRate',
      'field-retailRate',
      'field-functionRate',
      'field-originalRate',
    ];
    if (!isEditMode) {
      list.push('field-openingStock');
    }
    list.push('btn-submit');
    return list;
  }, [isEditMode]);

  // Load Categories, Units, and Product (if Edit mode)
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [fetchedCategories, fetchedUnits] = await Promise.all([
          categoryApi.listCategories(),
          unitApi.listUnits(),
        ]);
        if (!isMounted) return;

        setCategories(fetchedCategories);
        setUnits(fetchedUnits);

        if (isEditMode && productId && !isNaN(productId) && productId > 0) {
          const product = await productApi.getProductById(productId);
          if (!isMounted) return;

          setOriginalCategoryId(product.categoryId);
          setOriginalUnitId(product.unitId);

          const currentCat = fetchedCategories.find((c) => c.id === product.categoryId);
          if (currentCat) {
            setProductCategoryRef(currentCat);
          } else if (product.category) {
            setProductCategoryRef({
              id: product.category.id,
              categoryName: product.category.categoryName,
              tamilName: product.category.tamilName,
              displayOrder: product.category.displayOrder,
              active: product.category.active,
              createdAt: '',
              updatedAt: '',
            });
          }

          const currentUnit = fetchedUnits.find((u) => u.id === product.unitId);
          if (currentUnit) {
            setProductUnitRef(currentUnit);
          } else if (product.unit) {
            setProductUnitRef({
              id: product.unit.id,
              name: product.unit.name,
              shortName: product.unit.shortName,
              active: product.unit.active,
              createdAt: '',
              updatedAt: '',
            });
          }

          const initialEditData: FormData = {
            productCode: product.productCode,
            barcode: product.barcode || '',
            productName: product.productName,
            tamilName: product.tamilName || '',
            categoryId: String(product.categoryId),
            unitId: String(product.unitId),
            mrpRate: product.mrpRate,
            originalRate: product.originalRate,
            normalRate: product.normalRate,
            retailRate: product.retailRate,
            functionRate: product.functionRate,
            openingStock: '0.000',
            currentStock: product.currentStock,
            active: product.active,
          };
          setFormData(initialEditData);
          setInitialFormData(initialEditData);
        } else if (!isEditMode) {
          // Defaults for new product
          const activeCats = fetchedCategories.filter((c) => c.active);
          const activeUnits = fetchedUnits.filter((u) => u.active);

          const initialCreateData: FormData = {
            productCode: '',
            barcode: '',
            productName: '',
            tamilName: '',
            categoryId: activeCats.length > 0 ? String(activeCats[0].id) : '',
            unitId: activeUnits.length > 0 ? String(activeUnits[0].id) : '',
            mrpRate: '',
            originalRate: '',
            normalRate: '',
            retailRate: '',
            functionRate: '',
            openingStock: '0.000',
            currentStock: '0.000',
            active: true,
          };
          setFormData(initialCreateData);
          setInitialFormData(initialCreateData);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrors({ general: getApiErrorMessage(err, 'Failed to fetch form details.') });
        }
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isEditMode, productId]);

  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories]);
  const activeUnits = useMemo(() => units.filter((u) => u.active), [units]);

  // Selectable categories:
  // Create mode: active only
  // Edit mode: active + currently assigned category (even if inactive)
  const selectableCategories = useMemo(() => {
    if (!isEditMode) return activeCategories;
    const list = [...activeCategories];
    if (originalCategoryId && !list.some((c) => c.id === originalCategoryId)) {
      if (productCategoryRef) list.unshift(productCategoryRef);
    }
    return list;
  }, [isEditMode, activeCategories, originalCategoryId, productCategoryRef]);

  // Selectable units:
  // Create mode: active only
  // Edit mode: active + currently assigned unit (even if inactive)
  const selectableUnits = useMemo(() => {
    if (!isEditMode) return activeUnits;
    const list = [...activeUnits];
    if (originalUnitId && !list.some((u) => u.id === originalUnitId)) {
      if (productUnitRef) list.unshift(productUnitRef);
    }
    return list;
  }, [isEditMode, activeUnits, originalUnitId, productUnitRef]);

  // Fix D6: Detect dirty / unsaved changes
  const isDirty = useMemo(() => {
    if (!initialFormData) return false;
    return (
      formData.productCode !== initialFormData.productCode ||
      formData.barcode !== initialFormData.barcode ||
      formData.productName !== initialFormData.productName ||
      formData.tamilName !== initialFormData.tamilName ||
      formData.categoryId !== initialFormData.categoryId ||
      formData.unitId !== initialFormData.unitId ||
      formData.mrpRate !== initialFormData.mrpRate ||
      formData.normalRate !== initialFormData.normalRate ||
      formData.originalRate !== initialFormData.originalRate ||
      formData.retailRate !== initialFormData.retailRate ||
      formData.functionRate !== initialFormData.functionRate ||
      (!isEditMode && formData.openingStock !== initialFormData.openingStock) ||
      formData.active !== initialFormData.active
    );
  }, [formData, initialFormData, isEditMode]);

  const handleCancel = () => {
    if (isSavingRef.current || isSubmitting) return;
    if (isDirty) {
      lastActiveElementRef.current = document.activeElement as HTMLElement | null;
      setShowDiscardConfirm(true);
    } else {
      navigate('/admin/products');
    }
  };

  const closeDiscardModal = () => {
    setShowDiscardConfirm(false);
    setTimeout(() => {
      if (lastActiveElementRef.current && document.contains(lastActiveElementRef.current)) {
        lastActiveElementRef.current.focus();
      } else {
        const codeInput = document.getElementById('field-productCode') as HTMLInputElement | null;
        codeInput?.focus();
      }
    }, 0);
  };

  const validateField = (name: string, value: string): string | undefined => {
    if (name === 'productCode') {
      if (!value.trim()) return 'Product code is required';
    }
    if (name === 'productName') {
      if (!value.trim()) return 'Product name is required';
    }
    if (name === 'categoryId') {
      if (!value.trim() || Number(value) <= 0) return 'Category is required';
    }
    if (name === 'unitId') {
      if (!value.trim() || Number(value) <= 0) return 'Unit is required';
    }
    if (name === 'mrpRate' || name === 'normalRate') {
      if (!value.trim()) return 'Rate is required';
      const num = Number(value);
      if (isNaN(num) || num < 0) return 'Must be a non-negative number';
    }
    if (['originalRate', 'retailRate', 'functionRate'].includes(name)) {
      if (value.trim()) {
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Must be a non-negative number';
      }
    }
    if (name === 'openingStock' && !isEditMode) {
      if (value.trim()) {
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Must be a non-negative number';
      }
    }
    return undefined;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name as keyof FormErrors];
        return updated;
      });
    }
  };

  const validateForm = (): { isValid: boolean; firstErrorField?: string } => {
    const newErrors: FormErrors = {};
    let firstErrorField: string | undefined;

    const check = (field: keyof FormErrors, err?: string) => {
      if (err) {
        newErrors[field] = err;
        if (!firstErrorField) {
          firstErrorField = `field-${field}`;
        }
      }
    };

    check('productCode', validateField('productCode', formData.productCode));
    check('productName', validateField('productName', formData.productName));
    check('categoryId', validateField('categoryId', formData.categoryId));
    check('unitId', validateField('unitId', formData.unitId));
    check('mrpRate', validateField('mrpRate', formData.mrpRate));
    check('normalRate', validateField('normalRate', formData.normalRate));
    check('originalRate', validateField('originalRate', formData.originalRate));
    check('retailRate', validateField('retailRate', formData.retailRate));
    check('functionRate', validateField('functionRate', formData.functionRate));

    if (!isEditMode) {
      check('openingStock', validateField('openingStock', formData.openingStock));
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      firstErrorField,
    };
  };

  const isDirtyRef = useRef(false);
  const showDiscardConfirmRef = useRef(false);
  const executeSaveRef = useRef<(addAnother: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Fix D5: Ignore IME composition
      if (e.isComposing || e.keyCode === 229) {
        return;
      }

      // R3: Discard confirmation modal safety
      if (showDiscardConfirmRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowDiscardConfirm(false);
          setTimeout(() => {
            if (lastActiveElementRef.current && document.contains(lastActiveElementRef.current)) {
              lastActiveElementRef.current.focus();
            } else {
              const codeInput = document.getElementById('field-productCode') as HTMLInputElement | null;
              codeInput?.focus();
            }
          }, 0);
          return;
        }
        if (e.ctrlKey && e.key === 'Enter') {
          // Ctrl+Enter must NOT save while discard modal is open
          e.preventDefault();
          return;
        }
        return;
      }

      // Fix D6: Escape handling
      if (e.key === 'Escape') {
        if (isSavingRef.current || isSubmitting) {
          return;
        }
        e.preventDefault();
        if (isDirtyRef.current) {
          lastActiveElementRef.current = document.activeElement as HTMLElement | null;
          setShowDiscardConfirm(true);
          return;
        }
        navigate('/admin/products');
        return;
      }

      // Ctrl + Enter: Save
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        executeSaveRef.current(false);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isSubmitting, navigate]);

  // R3: Accessible Focus Trap & Safe Key Handler for Discard Modal
  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Escape: close modal without navigation (same as Stay)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDiscardModal();
      return;
    }

    // Ctrl+Enter: must NOT save
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Tab / Shift+Tab focus trap: keep focus within modal actions
    if (e.key === 'Tab') {
      const modalEl = modalRef.current;
      if (!modalEl) return;
      const focusable = Array.from(
        modalEl.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }

    // Shift+Enter: must not move hidden form focus
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Enter: activate currently focused modal button normally without bubbling to hidden form fields
    if (e.key === 'Enter' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const active = document.activeElement as HTMLElement | null;
      if (active && modalRef.current?.contains(active) && typeof (active as HTMLButtonElement).click === 'function') {
        (active as HTMLButtonElement).click();
      }
      return;
    }
  };

  // Keyboard Navigation: Enter & Shift+Enter field sequence navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // R3: When discard modal is open, keyboard events must NOT continue to operate on hidden form fields
    if (showDiscardConfirm) {
      return;
    }

    // Fix D5: Tamil IME composition safety (ignore composition Enter / 229)
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    // Escape and Ctrl+Enter are handled globally by window listener
    if (e.key === 'Escape' || (e.ctrlKey && e.key === 'Enter')) {
      return;
    }

    // Enter & Shift+Enter navigation
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      const targetId = target.id;
      const currentIndex = fieldSequence.indexOf(targetId);

      if (currentIndex === -1) return;

      e.preventDefault();

      if (e.shiftKey) {
        // Shift + Enter: Move to previous field
        if (currentIndex > 0) {
          const prevId = fieldSequence[currentIndex - 1];
          const prevEl = document.getElementById(prevId);
          if (prevEl) {
            prevEl.focus();
            if ('select' in prevEl && typeof (prevEl as HTMLInputElement).select === 'function') {
              (prevEl as HTMLInputElement).select();
            }
          }
        }
      } else {
        // Enter: Move to next field
        if (currentIndex < fieldSequence.length - 1) {
          const nextId = fieldSequence[currentIndex + 1];
          const nextEl = document.getElementById(nextId);
          if (nextEl) {
            nextEl.focus();
            if ('select' in nextEl && typeof (nextEl as HTMLInputElement).select === 'function') {
              (nextEl as HTMLInputElement).select();
            }
          }
        } else {
          // On last element (Save button), execute save
          executeSave(false);
        }
      }
    }
  };

  const executeSave = async (addAnother: boolean) => {
    // Fix D9: Synchronous submission lock to prevent double-submit
    if (isSavingRef.current || isSubmitting) return;

    if (!isEditMode && activeCategories.length === 0) {
      setErrors({ general: 'Cannot create product: No active categories exist. Please create an active category first.' });
      return;
    }

    if (!isEditMode && activeUnits.length === 0) {
      setErrors({ general: 'Cannot create product: No active units of measure exist. Please create an active unit first.' });
      return;
    }

    const validation = validateForm();
    if (!validation.isValid) {
      // Fix D7: Focus first invalid field on validation error
      if (validation.firstErrorField) {
        const el = document.getElementById(validation.firstErrorField) as HTMLInputElement | null;
        if (el) {
          el.focus();
          if ('select' in el && typeof el.select === 'function') {
            el.select();
          }
        }
      }
      return;
    }

    isSavingRef.current = true;
    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      if (isEditMode && productId) {
        const selectedCatIdNum = Number(formData.categoryId);
        const hasCategoryChanged = originalCategoryId !== null && selectedCatIdNum !== originalCategoryId;

        const selectedUnitIdNum = Number(formData.unitId);
        const hasUnitChanged = originalUnitId !== null && selectedUnitIdNum !== originalUnitId;

        const payload: UpdateProductInput = {
          productCode: formData.productCode.trim(),
          barcode: formData.barcode.trim() || null,
          productName: formData.productName.trim(),
          tamilName: formData.tamilName.trim() || null,
          ...(hasCategoryChanged ? { categoryId: selectedCatIdNum } : {}),
          ...(hasUnitChanged ? { unitId: selectedUnitIdNum } : {}),
          mrpRate: formData.mrpRate.trim(),
          normalRate: formData.normalRate.trim(),
          originalRate: formData.originalRate.trim() === '' ? null : formData.originalRate.trim(),
          retailRate: formData.retailRate.trim() === '' ? null : formData.retailRate.trim(),
          functionRate: formData.functionRate.trim() === '' ? null : formData.functionRate.trim(),
          active: formData.active,
        };

        await productApi.updateProduct(productId, payload);
        setSuccessMessage('Product updated successfully! Redirecting...');
        setTimeout(() => {
          navigate('/admin/products');
        }, 1000);
      } else {
        const payload: CreateProductInput = {
          productCode: formData.productCode.trim(),
          barcode: formData.barcode.trim() || null,
          productName: formData.productName.trim(),
          tamilName: formData.tamilName.trim() || null,
          categoryId: Number(formData.categoryId),
          unitId: Number(formData.unitId),
          mrpRate: formData.mrpRate.trim(),
          normalRate: formData.normalRate.trim(),
          ...(formData.originalRate.trim() ? { originalRate: formData.originalRate.trim() } : {}),
          ...(formData.retailRate.trim() ? { retailRate: formData.retailRate.trim() } : {}),
          ...(formData.functionRate.trim() ? { functionRate: formData.functionRate.trim() } : {}),
          ...(formData.openingStock.trim() ? { openingStock: formData.openingStock.trim() } : {}),
        };

        const created = await productApi.createProduct(payload);

        if (addAnother) {
          // Reset form for next entry
          const freshData: FormData = {
            productCode: '',
            barcode: '',
            productName: '',
            tamilName: '',
            categoryId: activeCategories.length > 0 ? String(activeCategories[0].id) : '',
            unitId: activeUnits.length > 0 ? String(activeUnits[0].id) : '',
            mrpRate: '',
            originalRate: '',
            normalRate: '',
            retailRate: '',
            functionRate: '',
            openingStock: '0.000',
            currentStock: '0.000',
            active: true,
          };
          setFormData(freshData);
          setInitialFormData(freshData);
          setSuccessMessage(`Product "${created.productName}" created! Ready for next entry.`);
          setTimeout(() => setSuccessMessage(null), 3000);

          // Release lock for next entry
          isSavingRef.current = false;
          setIsSubmitting(false);

          // Focus back to Product Code
          setTimeout(() => {
            const codeInput = document.getElementById('field-productCode') as HTMLInputElement | null;
            if (codeInput) {
              codeInput.focus();
              codeInput.select();
            }
          }, 50);
        } else {
          setSuccessMessage('Product created successfully! Redirecting...');
          setTimeout(() => {
            navigate('/admin/products');
          }, 1000);
        }
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to save product.');
      setErrors({ general: msg });

      // Fix D7, D9 & R2: Release submission lock so keyboard and buttons remain usable
      isSavingRef.current = false;
      setIsSubmitting(false);

      // R1 & R2: Restore useful keyboard focus
      setTimeout(() => {
        const lower = msg.toLowerCase();

        // 1. If API error clearly refers to barcode: focus Barcode field
        if (lower.includes('barcode')) {
          const barcodeEl = document.getElementById('field-barcode') as HTMLInputElement | null;
          if (barcodeEl) {
            barcodeEl.focus();
            barcodeEl.select?.();
            return;
          }
        }

        // 2. Else if API error refers to product code (or generic conflict/duplicate on code): focus Product Code
        if (
          lower.includes('product code') ||
          lower.includes('code') ||
          lower.includes('already exists') ||
          lower.includes('conflict') ||
          lower.includes('duplicate')
        ) {
          const codeEl = document.getElementById('field-productCode') as HTMLInputElement | null;
          if (codeEl) {
            codeEl.focus();
            codeEl.select?.();
            return;
          }
        }

        // 3. Generic save failures (network/API failure):
        // Preferred: focus Product Code in create mode.
        // In edit mode: focus the first editable field, normally Product Code if editable, otherwise Product Name.
        const codeEl = document.getElementById('field-productCode') as HTMLInputElement | null;
        if (codeEl && !codeEl.disabled && !codeEl.readOnly) {
          codeEl.focus();
          codeEl.select?.();
          return;
        }

        const nameEl = document.getElementById('field-productName') as HTMLInputElement | null;
        if (nameEl && !nameEl.disabled && !nameEl.readOnly) {
          nameEl.focus();
          nameEl.select?.();
        }
      }, 50);
    }
  };

  useEffect(() => {
    isDirtyRef.current = isDirty;
    showDiscardConfirmRef.current = showDiscardConfirm;
    executeSaveRef.current = executeSave;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave(false);
  };

  const handleCreateAndAddAnother = (e: React.MouseEvent) => {
    e.preventDefault();
    executeSave(true);
  };

  if (isInvalidId) {
    return (
      <div className="product-form-error-state">
        <div className="empty-icon-box" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>Invalid Product Identifier</h2>
        <p className="text-muted">The product identifier provided is invalid.</p>
        <Link to="/admin/products" className="btn btn-primary">
          Back to Products
        </Link>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="product-form-loading">
        <div className="auth-spinner"></div>
        <p>Loading product details...</p>
      </div>
    );
  }

  return (
    <div className="product-form-layout" onKeyDown={handleKeyDown}>
      {/* Top Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              Admin
            </Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/admin/products" className="breadcrumb-link">
              Products
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{isEditMode ? 'Edit' : 'New Product'}</span>
          </div>
          <h2 className="page-title">{isEditMode ? 'Edit Product' : 'Add New Product'}</h2>
          <span className="page-subtitle">
            {isEditMode
              ? `Editing ${formData.productName || 'Product'} (Code: ${formData.productCode})`
              : 'Enter product details with fast keyboard entry'}
          </span>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCancel}
            title="Return to Product Management"
          >
            ← Back to Products
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible">
          <div className="alert-content-with-icon">
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
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Global Error */}
      {errors.general && (
        <div className="alert alert-error alert-dismissible">
          <span>{errors.general}</span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setErrors((prev) => ({ ...prev, general: undefined }))}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Compact Product Form */}
      <form onSubmit={handleSubmit} className="product-form" noValidate>
        {/* SECTION 1: BASIC DETAILS */}
        <div className="form-card">
          <div className="form-card-header">
            <div className="section-step-badge">1</div>
            <div>
              <h3 className="form-card-title">Basic Details</h3>
              <span className="form-card-desc">Core product identification, taxonomy and barcode</span>
            </div>
          </div>

          <div className="product-form-grid-3">
            {/* 1. Product Code */}
            <div className="form-group">
              <label htmlFor="field-productCode">
                Product Code <span className="required-star">*</span>
              </label>
              <input
                id="field-productCode"
                name="productCode"
                type="text"
                value={formData.productCode}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. 0012, RICE-01"
                maxLength={20}
                className={`form-input font-mono ${errors.productCode ? 'input-error' : ''}`}
                autoFocus
              />
              {errors.productCode && (
                <span className="field-error">{errors.productCode}</span>
              )}
              <span className="form-help-text">Unique code or SKU (max 20 chars)</span>
            </div>

            {/* 2. Product Name */}
            <div className="form-group">
              <label htmlFor="field-productName">
                Product Name <span className="required-star">*</span>
              </label>
              <input
                id="field-productName"
                name="productName"
                type="text"
                value={formData.productName}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. Ponni Boiled Rice 1kg"
                maxLength={100}
                className={`form-input ${errors.productName ? 'input-error' : ''}`}
              />
              {errors.productName && (
                <span className="field-error">{errors.productName}</span>
              )}
              <span className="form-help-text">Primary billing display name</span>
            </div>

            {/* 3. Tamil Name */}
            <div className="form-group">
              <label htmlFor="field-tamilName">
                Tamil Name <span className="form-label-optional">(optional)</span>
              </label>
              <input
                id="field-tamilName"
                name="tamilName"
                type="text"
                value={formData.tamilName}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. பொன்னி புழுங்கல் அரிசி"
                maxLength={100}
                className="form-input tamil-text"
              />
              <span className="form-help-text">Optional Tamil name for POS and receipts</span>
            </div>

            {/* 4. Category */}
            <div className="form-group">
              <div className="form-label-with-link">
                <label htmlFor="field-categoryId">
                  Category <span className="required-star">*</span>
                </label>
                <Link to="/admin/categories" tabIndex={-1} className="link-inline">
                  Manage
                </Link>
              </div>
              <select
                id="field-categoryId"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className={`form-input form-select ${errors.categoryId ? 'input-error' : ''}`}
              >
                <option value="">Select Category</option>
                {selectableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.categoryName} {!cat.active ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <span className="field-error">{errors.categoryId}</span>
              )}
              <span className="form-help-text">Product classification category</span>
            </div>

            {/* 5. Unit of Measure */}
            <div className="form-group">
              <div className="form-label-with-link">
                <label htmlFor="field-unitId">
                  Unit of Measure <span className="required-star">*</span>
                </label>
                <Link to="/admin/units" tabIndex={-1} className="link-inline">
                  Manage
                </Link>
              </div>
              <select
                id="field-unitId"
                name="unitId"
                value={formData.unitId}
                onChange={handleChange}
                className={`form-input form-select ${errors.unitId ? 'input-error' : ''}`}
              >
                <option value="">Select Unit</option>
                {selectableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.shortName}) {!u.active ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
              {isEditMode && productUnitRef && !productUnitRef.active && formData.unitId === String(productUnitRef.id) && (
                <span className="field-warning-text">
                  Current unit is inactive. You may keep it or select an active unit.
                </span>
              )}
              {errors.unitId && (
                <span className="field-error">{errors.unitId}</span>
              )}
              <span className="form-help-text">Measurement unit for pricing & billing</span>
            </div>

            {/* 6. Barcode */}
            <div className="form-group">
              <label htmlFor="field-barcode">
                Barcode <span className="form-label-optional">(optional)</span>
              </label>
              <input
                id="field-barcode"
                name="barcode"
                type="text"
                value={formData.barcode}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. 8901030012345"
                maxLength={50}
                className="form-input font-mono"
              />
              <span className="form-help-text">EAN/UPC barcode for quick scanner input</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRICING */}
        <div className="form-card">
          <div className="form-card-header">
            <div className="section-step-badge">2</div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="form-card-title">Pricing</h3>
                <span className="form-card-desc">Counter rates, wholesale/function pricing and base cost</span>
              </div>
              <span className="form-currency-note">All prices in Indian Rupees (₹)</span>
            </div>
          </div>

          <div className="product-form-pricing-grid">
            {/* 7. MRP */}
            <div className="form-group">
              <label htmlFor="field-mrpRate">
                MRP <span className="required-star">*</span>
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="field-mrpRate"
                  name="mrpRate"
                  type="text"
                  value={formData.mrpRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  className={`form-input font-mono input-with-prefix ${
                    errors.mrpRate ? 'input-error' : ''
                  }`}
                />
              </div>
              {errors.mrpRate && (
                <span className="field-error">{errors.mrpRate}</span>
              )}
              <span className="form-help-text">Maximum Retail Price</span>
            </div>

            {/* 8. Normal Rate */}
            <div className="form-group">
              <label htmlFor="field-normalRate">
                Normal Rate <span className="required-star">*</span>
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="field-normalRate"
                  name="normalRate"
                  type="text"
                  value={formData.normalRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  className={`form-input font-mono font-semibold text-primary input-with-prefix ${
                    errors.normalRate ? 'input-error' : ''
                  }`}
                />
              </div>
              {errors.normalRate && (
                <span className="field-error">{errors.normalRate}</span>
              )}
              <span className="form-help-text">Standard selling rate</span>
            </div>

            {/* 9. Retail Rate */}
            <div className="form-group">
              <label htmlFor="field-retailRate">
                Retail Rate
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="field-retailRate"
                  name="retailRate"
                  type="text"
                  value={formData.retailRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  placeholder={formData.normalRate || '0.00'}
                  className="form-input font-mono input-with-prefix"
                />
              </div>
              {errors.retailRate && (
                <span className="field-error">{errors.retailRate}</span>
              )}
              <span className="form-help-text">Discounted retail rate</span>
            </div>

            {/* 10. Function Rate */}
            <div className="form-group">
              <label htmlFor="field-functionRate">
                Function Rate
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="field-functionRate"
                  name="functionRate"
                  type="text"
                  value={formData.functionRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  placeholder={formData.normalRate || '0.00'}
                  className="form-input font-mono input-with-prefix"
                />
              </div>
              {errors.functionRate && (
                <span className="field-error">{errors.functionRate}</span>
              )}
              <span className="form-help-text">Bulk/order rate</span>
            </div>

            {/* 11. Cost / Original Rate */}
            <div className="form-group">
              <label htmlFor="field-originalRate">
                Cost Rate
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="field-originalRate"
                  name="originalRate"
                  type="text"
                  value={formData.originalRate}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  className="form-input font-mono input-with-prefix"
                />
              </div>
              {errors.originalRate && (
                <span className="field-error">{errors.originalRate}</span>
              )}
              <span className="form-help-text">Base purchase cost</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: INVENTORY */}
        <div className="form-card">
          <div className="form-card-header">
            <div className="section-step-badge">3</div>
            <div>
              <h3 className="form-card-title">Inventory</h3>
              <span className="form-card-desc">
                {isEditMode
                  ? 'Current on-hand inventory status and catalog availability'
                  : 'Initial opening stock ledger entry'}
              </span>
            </div>
          </div>

          {!isEditMode ? (
            <div className="product-form-grid-3">
              <div className="form-group">
                <label htmlFor="field-openingStock">
                  Opening Stock
                </label>
                <input
                  id="field-openingStock"
                  name="openingStock"
                  type="text"
                  value={formData.openingStock}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.000"
                  className={`form-input font-mono ${
                    errors.openingStock ? 'input-error' : ''
                  }`}
                />
                {errors.openingStock && (
                  <span className="field-error">{errors.openingStock}</span>
                )}
                <span className="form-help-text">
                  Initial quantity on hand. Creates an OPENING_STOCK ledger record.
                </span>
              </div>
            </div>
          ) : (
            <div className="product-inventory-edit-row">
              <div className="stock-readonly-card" style={{ flex: 1 }}>
                <div className="stock-readonly-content">
                  <div className="stock-readonly-label">Current Stock on Hand</div>
                  <div className="stock-readonly-value font-mono">
                    {formatQuantity(formData.currentStock)}
                  </div>
                </div>
                <div className="stock-readonly-note">
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
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Stock is changed via Stock In/Out flows, not direct product edit.</span>
                </div>
              </div>

              <div className="status-toggle-wrapper" style={{ minWidth: '240px' }}>
                <label htmlFor="field-active" className="switch-label">
                  <input
                    id="field-active"
                    name="active"
                    type="checkbox"
                    checked={formData.active}
                    onChange={handleChange}
                    className="switch-checkbox"
                  />
                  <span className="switch-text">Product Active in Billing Catalog</span>
                </label>
                <span className="form-help-text" style={{ paddingLeft: '24px' }}>
                  When unchecked, hidden from cashier search and POS terminal
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: ACTIONS */}
        <div className="product-form-bottom-bar">
          <div className="keyboard-shortcuts-pill">
            <span className="shortcut-item"><kbd>Enter</kbd> Next</span>
            <span className="shortcut-sep">•</span>
            <span className="shortcut-item"><kbd>Shift+Enter</kbd> Prev</span>
            <span className="shortcut-sep">•</span>
            <span className="shortcut-item"><kbd>Ctrl+Enter</kbd> Save</span>
            <span className="shortcut-sep">•</span>
            <span className="shortcut-item"><kbd>Esc</kbd> Cancel</span>
          </div>

          <div className="form-actions-group">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="btn btn-outline"
            >
              Cancel
            </button>

            {!isEditMode && (
              <button
                id="btn-save-and-add-another"
                type="button"
                onClick={handleCreateAndAddAnother}
                disabled={isSubmitting}
                className="btn btn-outline btn-save-another"
              >
                Create & Add Another
              </button>
            )}

            <button
              id="btn-submit"
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-save"
            >
              {isSubmitting ? (
                <>
                  <span className="btn-spinner"></span>
                  Saving...
                </>
              ) : isEditMode ? (
                'Save Changes'
              ) : (
                'Create Product'
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Fix D6 & R3: Unsaved Changes / Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
          className="modal-backdrop"
          onKeyDown={handleModalKeyDown}
        >
          <div className="modal-dialog modal-dialog-sm">
            <div className="modal-header">
              <h3 id="discard-dialog-title" className="modal-title">
                Discard unsaved changes?
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeDiscardModal}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="confirm-content">
                <p>You have unsaved changes in this form. If you leave now, your changes will be discarded.</p>
                <div className="confirm-warning-box">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Unsaved entries and edits will be lost permanently.</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                ref={stayBtnRef}
                type="button"
                onClick={closeDiscardModal}
                className="btn btn-outline"
              >
                Stay
              </button>
              <button
                ref={discardBtnRef}
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  navigate('/admin/products');
                }}
                className="btn btn-danger"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFormPage;
