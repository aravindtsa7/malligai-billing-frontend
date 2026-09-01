import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { productApi } from '../api/product.api.ts';
import { categoryApi } from '../api/category.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import { formatQuantity } from '../utils/decimal.ts';
import type { Category } from '../types/category.types.ts';
import { UNITS, type Unit, type CreateProductInput, type UpdateProductInput } from '../types/product.types.ts';

interface FormData {
  productCode: string;
  barcode: string;
  productName: string;
  tamilName: string;
  categoryId: string;
  unit: Unit;
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
  unit?: string;
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
    unit: 'PIECE',
    mrpRate: '',
    originalRate: '',
    normalRate: '',
    retailRate: '',
    functionRate: '',
    openingStock: '0.000',
    currentStock: '0.000',
    active: true,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [originalCategoryId, setOriginalCategoryId] = useState<number | null>(null);
  const [productCategoryRef, setProductCategoryRef] = useState<Category | null>(null);

  const isInvalidId = isEditMode && (!productId || isNaN(productId) || productId <= 0);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        // 1. Fetch categories
        const fetchedCategories = await categoryApi.listCategories();
        if (!isMounted) return;
        setCategories(fetchedCategories);

        // 2. Fetch product details if in edit mode
        if (isEditMode && productId && !isNaN(productId) && productId > 0) {
          const product = await productApi.getProductById(productId);
          if (!isMounted) return;

          setOriginalCategoryId(product.categoryId);

          // Check if current category exists in fetched categories
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

          setFormData({
            productCode: product.productCode,
            barcode: product.barcode || '',
            productName: product.productName,
            tamilName: product.tamilName || '',
            categoryId: String(product.categoryId),
            unit: product.unit,
            mrpRate: product.mrpRate,
            originalRate: product.originalRate,
            normalRate: product.normalRate,
            retailRate: product.retailRate,
            functionRate: product.functionRate,
            openingStock: '0.000',
            currentStock: product.currentStock,
            active: product.active,
          });
        } else if (!isEditMode) {
          // In create mode, if active categories exist, pick first one as default
          const activeCats = fetchedCategories.filter((c) => c.active);
          if (activeCats.length > 0) {
            setFormData((prev) => ({
              ...prev,
              categoryId: String(activeCats[0].id),
            }));
          }
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

  const activeCategories = categories.filter((c) => c.active);
  const noActiveCategories = !isEditMode && activeCategories.length === 0;

  // Determine categories to display in dropdown:
  // - In Create mode: only active categories
  // - In Edit mode: all active categories + current category (even if inactive)
  const selectableCategories = React.useMemo(() => {
    if (!isEditMode) {
      return activeCategories;
    }
    const currentId = originalCategoryId;
    const list = [...activeCategories];
    if (currentId && !list.some((c) => c.id === currentId)) {
      if (productCategoryRef) {
        list.unshift(productCategoryRef);
      }
    }
    return list;
  }, [isEditMode, activeCategories, originalCategoryId, productCategoryRef]);

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
    if (name === 'mrpRate' || name === 'normalRate') {
      if (!value.trim()) return 'Rate is required';
      const num = Number(value);
      if (isNaN(num) || num < 0) return 'Must be a valid non-negative number';
    }
    if (['originalRate', 'retailRate', 'functionRate'].includes(name)) {
      if (value.trim()) {
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Must be a valid non-negative number';
      }
    }
    if (name === 'openingStock' && !isEditMode) {
      if (value.trim()) {
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Must be a valid non-negative number';
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

    // Clear field-specific error when modified
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name as keyof FormErrors];
        return updated;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const codeErr = validateField('productCode', formData.productCode);
    if (codeErr) newErrors.productCode = codeErr;

    const nameErr = validateField('productName', formData.productName);
    if (nameErr) newErrors.productName = nameErr;

    const catErr = validateField('categoryId', formData.categoryId);
    if (catErr) newErrors.categoryId = catErr;

    const mrpErr = validateField('mrpRate', formData.mrpRate);
    if (mrpErr) newErrors.mrpRate = mrpErr;

    const normErr = validateField('normalRate', formData.normalRate);
    if (normErr) newErrors.normalRate = normErr;

    const origErr = validateField('originalRate', formData.originalRate);
    if (origErr) newErrors.originalRate = origErr;

    const retErr = validateField('retailRate', formData.retailRate);
    if (retErr) newErrors.retailRate = retErr;

    const funcErr = validateField('functionRate', formData.functionRate);
    if (funcErr) newErrors.functionRate = funcErr;

    if (!isEditMode) {
      const stockErr = validateField('openingStock', formData.openingStock);
      if (stockErr) newErrors.openingStock = stockErr;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (noActiveCategories) {
      setErrors({ general: 'Cannot create product: No active categories exist. Please create an active category first.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      if (isEditMode && productId) {
        // Inactive Category Rule:
        // If category is NOT changed by user, omit categoryId from PUT payload (undefined)
        // so that editing products with an existing inactive category succeeds smoothly.
        // If category IS changed, include categoryId (which is guaranteed to be an active category).
        const selectedCatIdNum = Number(formData.categoryId);
        const hasCategoryChanged = originalCategoryId !== null && selectedCatIdNum !== originalCategoryId;

        const payload: UpdateProductInput = {
          productCode: formData.productCode.trim(),
          barcode: formData.barcode.trim() || null,
          productName: formData.productName.trim(),
          tamilName: formData.tamilName.trim() || null,
          ...(hasCategoryChanged ? { categoryId: selectedCatIdNum } : {}),
          unit: formData.unit,
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
        }, 800);
      } else {
        // Prepare POST payload (categoryId is required)
        const payload: CreateProductInput = {
          productCode: formData.productCode.trim(),
          barcode: formData.barcode.trim() || null,
          productName: formData.productName.trim(),
          tamilName: formData.tamilName.trim() || null,
          categoryId: Number(formData.categoryId),
          unit: formData.unit,
          mrpRate: formData.mrpRate.trim(),
          normalRate: formData.normalRate.trim(),
          ...(formData.originalRate.trim() ? { originalRate: formData.originalRate.trim() } : {}),
          ...(formData.retailRate.trim() ? { retailRate: formData.retailRate.trim() } : {}),
          ...(formData.functionRate.trim() ? { functionRate: formData.functionRate.trim() } : {}),
          openingStock: formData.openingStock.trim() || '0',
        };

        await productApi.createProduct(payload);
        setSuccessMessage('Product created successfully! Redirecting...');
        setTimeout(() => {
          navigate('/admin/products');
        }, 800);
      }
    } catch (err: unknown) {
      setErrors({
        general: getApiErrorMessage(err, isEditMode ? 'Failed to update product.' : 'Failed to create product.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="product-form-loading">
        <div className="auth-spinner"></div>
        <p>Loading product details...</p>
      </div>
    );
  }

  if (isInvalidId || (isEditMode && errors.general && !formData.productCode)) {
    return (
      <div className="product-form-error-state">
        <div className="alert alert-error">
          <p>{isInvalidId ? 'Invalid product ID specified.' : errors.general}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/products')}>
          ← Back to Products List
        </button>
      </div>
    );
  }

  return (
    <div className="product-form-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/admin/products" className="breadcrumb-link">
              Products
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">
              {isEditMode ? `Edit Product (${formData.productCode || 'ID ' + productId})` : 'Add New Product'}
            </span>
          </div>
          <h2 className="page-title">{isEditMode ? 'Edit Product' : 'Add New Product'}</h2>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/admin/products')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {errors.general && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errors.general}</span>
        </div>
      )}

      {noActiveCategories && (
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>No active categories found!</strong> A category must be created and active before you can add products.
          </div>
          <Link to="/admin/categories" className="btn btn-sm btn-primary">
            Manage Categories →
          </Link>
        </div>
      )}

      <form className="product-form" onSubmit={handleSubmit} noValidate>
        {/* Section 1: Basic Information */}
        <div className="form-card">
          <div className="form-card-header">
            <div className="section-step-badge">1</div>
            <div>
              <h3 className="form-card-title">Product Details</h3>
              <span className="form-card-desc">Identifiers, category classification, descriptions, and unit</span>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="productCode">
                Product Code <span className="required-star">*</span>
              </label>
              <input
                id="productCode"
                name="productCode"
                type="text"
                className={`form-input font-mono ${errors.productCode ? 'input-error' : ''}`}
                placeholder="e.g. PROD-001, SUGAR-1KG"
                value={formData.productCode}
                onChange={handleChange}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.productCode && <span className="field-error">{errors.productCode}</span>}
              <span className="form-help-text">Unique code identifier for shop inventory</span>
            </div>

            <div className="form-group">
              <label htmlFor="barcode">Barcode</label>
              <input
                id="barcode"
                name="barcode"
                type="text"
                className="form-input font-mono"
                placeholder="e.g. 8901234567890"
                value={formData.barcode}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <span className="form-help-text">Optional scanning barcode (EAN-13, UPC, etc.)</span>
            </div>

            <div className="form-group">
              <label htmlFor="productName">
                Product Name <span className="required-star">*</span>
              </label>
              <input
                id="productName"
                name="productName"
                type="text"
                className={`form-input ${errors.productName ? 'input-error' : ''}`}
                placeholder="e.g. Ponni Rice 25kg, Tata Salt"
                value={formData.productName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.productName && <span className="field-error">{errors.productName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="tamilName">Tamil Name</label>
              <input
                id="tamilName"
                name="tamilName"
                type="text"
                className="form-input tamil-text"
                placeholder="e.g. பொன்னி அரிசி, உப்பு"
                value={formData.tamilName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <span className="form-help-text">Optional Tamil description for print receipts</span>
            </div>

            <div className="form-group">
              <label htmlFor="categoryId">
                Category <span className="required-star">*</span>
              </label>
              <select
                id="categoryId"
                name="categoryId"
                className={`form-input form-select ${errors.categoryId ? 'input-error' : ''}`}
                value={formData.categoryId}
                onChange={handleChange}
                disabled={isSubmitting || noActiveCategories}
              >
                {selectableCategories.length === 0 ? (
                  <option value="">No active categories available</option>
                ) : (
                  selectableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.categoryName} {!cat.active ? '(Inactive)' : ''}
                    </option>
                  ))
                )}
              </select>
              {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
              <span className="form-help-text">
                Category classification for grouping and quick billing selector
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="unit">
                Unit of Measure <span className="required-star">*</span>
              </label>
              <select
                id="unit"
                name="unit"
                className="form-input form-select"
                value={formData.unit}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <span className="form-help-text">Measurement unit for pricing & billing</span>
            </div>

            {isEditMode && (
              <div className="form-group">
                <label htmlFor="active">Status</label>
                <div className="status-toggle-wrapper">
                  <label className="switch-label">
                    <input
                      id="active"
                      name="active"
                      type="checkbox"
                      className="switch-checkbox"
                      checked={formData.active}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    <span className="switch-text">
                      {formData.active ? 'Active (Available for billing)' : 'Inactive (Hidden / Disabled)'}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Rates & Pricing */}
        <div className="form-card">
          <div className="form-card-header">
            <div className="section-step-badge">2</div>
            <div>
              <h3 className="form-card-title">Pricing & Rates</h3>
              <span className="form-card-desc">MRP, default counter selling rate, and optional tier rates</span>
            </div>
          </div>

          <div className="rates-notice">
            <div className="notice-item">
              <strong>Mandatory Rates:</strong> MRP Rate and Normal Selling Rate are required for all products.
            </div>
            <div className="notice-item">
              <strong>Optional Rates:</strong> Original / Cost Rate defaults to 0.00 if left blank. Retail and Function rates default to the Normal Selling Rate if left blank.
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="mrpRate">
                MRP Rate (₹) <span className="required-star">*</span>
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="mrpRate"
                  name="mrpRate"
                  type="text"
                  className={`form-input font-mono input-with-prefix ${errors.mrpRate ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={formData.mrpRate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.mrpRate && <span className="field-error">{errors.mrpRate}</span>}
              <span className="form-help-text">Maximum Retail Price printed on package</span>
            </div>

            <div className="form-group">
              <label htmlFor="normalRate">
                Normal Selling Rate (₹) <span className="required-star">*</span>
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="normalRate"
                  name="normalRate"
                  type="text"
                  className={`form-input font-mono input-with-prefix ${errors.normalRate ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={formData.normalRate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.normalRate && <span className="field-error">{errors.normalRate}</span>}
              <span className="form-help-text">Default selling price for counter billing</span>
            </div>

            <div className="form-group">
              <label htmlFor="originalRate">
                Original / Cost Rate (₹)
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="originalRate"
                  name="originalRate"
                  type="text"
                  className={`form-input font-mono input-with-prefix ${errors.originalRate ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={formData.originalRate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.originalRate && <span className="field-error">{errors.originalRate}</span>}
              <span className="form-help-text">Purchase / cost price per {formData.unit} (defaults to 0.00)</span>
            </div>

            <div className="form-group">
              <label htmlFor="retailRate">
                Retail Selling Rate (₹)
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="retailRate"
                  name="retailRate"
                  type="text"
                  className={`form-input font-mono input-with-prefix ${errors.retailRate ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={formData.retailRate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.retailRate && <span className="field-error">{errors.retailRate}</span>}
              <span className="form-help-text">Discounted retail rate (defaults to Normal rate)</span>
            </div>

            <div className="form-group">
              <label htmlFor="functionRate">
                Function / Bulk Rate (₹)
              </label>
              <div className="input-prefix-wrapper">
                <span className="input-prefix">₹</span>
                <input
                  id="functionRate"
                  name="functionRate"
                  type="text"
                  className={`form-input font-mono input-with-prefix ${errors.functionRate ? 'input-error' : ''}`}
                  placeholder="0.00"
                  value={formData.functionRate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {errors.functionRate && <span className="field-error">{errors.functionRate}</span>}
              <span className="form-help-text">Bulk rate for functions & orders (defaults to Normal rate)</span>
            </div>
          </div>
        </div>

        {/* Section 3: Stock Management */}
        <div className="form-card">
          <div className="form-card-header">
            <div className="section-step-badge">3</div>
            <div>
              <h3 className="form-card-title">Stock Inventory</h3>
              <span className="form-card-desc">
                {isEditMode ? 'Current on-hand inventory status' : 'Set initial opening stock level'}
              </span>
            </div>
          </div>

          {!isEditMode ? (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="openingStock">Opening Stock ({formData.unit})</label>
                <input
                  id="openingStock"
                  name="openingStock"
                  type="text"
                  className={`form-input font-mono ${errors.openingStock ? 'input-error' : ''}`}
                  placeholder="0.000"
                  value={formData.openingStock}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.openingStock && <span className="field-error">{errors.openingStock}</span>}
                <span className="form-help-text">
                  Initial stock quantity on hand. Creates an OPENING_STOCK ledger record.
                </span>
              </div>
            </div>
          ) : (
            <div className="stock-readonly-card">
              <div className="stock-readonly-content">
                <div className="stock-readonly-label">Current Stock on Hand</div>
                <div className="stock-readonly-value font-mono">
                  {formatQuantity(formData.currentStock)} <span className="unit-label">{formData.unit}</span>
                </div>
              </div>
              <div className="stock-readonly-note">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span><strong>Stock changes are managed from Stock Management.</strong> Direct stock modification is protected to preserve transaction ledger integrity.</span>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/admin/products')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-save"
            disabled={isSubmitting || noActiveCategories}
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
      </form>
    </div>
  );
};
