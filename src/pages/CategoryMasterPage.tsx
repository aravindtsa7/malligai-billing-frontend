import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { categoryApi } from '../api/category.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../types/category.types.ts';

interface CategoryFormData {
  categoryName: string;
  tamilName: string;
  displayOrder: string;
}

interface CategoryFormErrors {
  categoryName?: string;
  displayOrder?: string;
  general?: string;
}

export const CategoryMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    categoryName: '',
    tamilName: '',
    displayOrder: '0',
  });
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Status Confirmation Dialog State
  const [statusConfirmCategory, setStatusConfirmCategory] = useState<Category | null>(null);
  const [isStatusChanging, setIsStatusChanging] = useState<boolean>(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await categoryApi.listCategories();
      setCategories(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load categories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const data = await categoryApi.listCategories();
        if (isMounted) {
          setCategories(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(getApiErrorMessage(err, 'Failed to load categories.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    // Find highest displayOrder + 1 as convenience default
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.displayOrder), 0);
    setFormData({
      categoryName: '',
      tamilName: '',
      displayOrder: String(categories.length > 0 ? maxOrder + 1 : 0),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      categoryName: category.categoryName,
      tamilName: category.tamilName || '',
      displayOrder: String(category.displayOrder),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormErrors({});
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (formErrors[name as keyof CategoryFormErrors]) {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[name as keyof CategoryFormErrors];
        return updated;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: CategoryFormErrors = {};
    const trimmedName = formData.categoryName.trim();

    if (!trimmedName) {
      errors.categoryName = 'Category name is required';
    } else if (trimmedName.length > 191) {
      errors.categoryName = 'Category name is too long (max 191 characters)';
    }

    if (formData.displayOrder.trim() === '') {
      errors.displayOrder = 'Display order is required';
    } else {
      const orderNum = Number(formData.displayOrder);
      if (isNaN(orderNum) || !Number.isInteger(orderNum) || orderNum < 0) {
        errors.displayOrder = 'Display order must be a non-negative integer (e.g. 0, 1, 2)';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const displayOrder = parseInt(formData.displayOrder.trim(), 10) || 0;
      const categoryName = formData.categoryName.trim();
      const tamilName = formData.tamilName.trim() || null;

      if (editingCategory) {
        const payload: UpdateCategoryInput = {
          categoryName,
          tamilName,
          displayOrder,
        };
        await categoryApi.updateCategory(editingCategory.id, payload);
        setSuccessMessage(`Category "${categoryName}" updated successfully.`);
      } else {
        const payload: CreateCategoryInput = {
          categoryName,
          tamilName,
          displayOrder,
        };
        await categoryApi.createCategory(payload);
        setSuccessMessage(`Category "${categoryName}" created successfully.`);
      }

      setIsModalOpen(false);
      setEditingCategory(null);
      await fetchCategories();

      // Clear success notification after 4 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: unknown) {
      setFormErrors({
        general: getApiErrorMessage(
          err,
          editingCategory ? 'Failed to update category.' : 'Failed to create category.'
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Toggle Confirmation
  const handleOpenStatusConfirm = (category: Category) => {
    setStatusConfirmCategory(category);
  };

  const handleCloseStatusConfirm = () => {
    if (isStatusChanging) return;
    setStatusConfirmCategory(null);
  };

  const handleToggleStatus = async () => {
    if (!statusConfirmCategory || isStatusChanging) return;

    setIsStatusChanging(true);
    try {
      const newStatus = !statusConfirmCategory.active;
      await categoryApi.updateCategoryStatus(statusConfirmCategory.id, newStatus);

      const actionText = newStatus ? 'activated' : 'deactivated';
      setSuccessMessage(`Category "${statusConfirmCategory.categoryName}" ${actionText} successfully.`);
      setStatusConfirmCategory(null);
      await fetchCategories();

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update category status.'));
      setStatusConfirmCategory(null);
    } finally {
      setIsStatusChanging(false);
    }
  };

  return (
    <div className="category-master-page">
      {/* Page Header */}
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
            <span className="breadcrumb-current">Categories</span>
          </div>
          <h2 className="page-title">Category Master</h2>
          <span className="page-subtitle">
            Manage product category taxonomy, display ordering, and billing availability
          </span>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/admin/products')}
            title="Return to Product Management"
          >
            ← View Products
          </button>
          <button
            type="button"
            className="btn btn-outline btn-refresh"
            onClick={fetchCategories}
            disabled={loading}
            title="Refresh categories list"
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
          <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
            + Add Category
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
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline" onClick={fetchCategories}>
            Retry
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="category-info-banner">
        <div className="category-info-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="category-info-content">
          <strong>Category Hierarchy & Rules:</strong> Categories control product organization in both admin product management and the POS terminal. Inactive categories retain existing products for historical data, but cannot be assigned to new products. Categories cannot be deleted.
        </div>
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        {loading ? (
          <div className="table-loading-state">
            <div className="auth-spinner"></div>
            <p>Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-icon-box" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <h3>No categories found</h3>
            <p>
              Get started by creating your first category.{' '}
              <button type="button" className="link-button" onClick={handleOpenAddModal}>
                + Add Category
              </button>
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }} className="text-center">Order</th>
                <th>Category Name</th>
                <th>Tamil Name</th>
                <th className="text-center" style={{ width: '120px' }}>Status</th>
                <th className="text-center" style={{ width: '180px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className={!cat.active ? 'row-inactive' : ''}>
                  <td className="text-center font-mono font-semibold">
                    <span className="order-pill">{cat.displayOrder}</span>
                  </td>
                  <td className="font-semibold text-primary">
                    {cat.categoryName}
                  </td>
                  <td className="tamil-text text-muted">
                    {cat.tamilName || '—'}
                  </td>
                  <td className="text-center">
                    <span className={`status-badge ${cat.active ? 'status-active' : 'status-inactive'}`}>
                      {cat.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="table-action-group">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleOpenEditModal(cat)}
                        title={`Edit ${cat.categoryName}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${cat.active ? 'btn-status-deactivate' : 'btn-status-activate'}`}
                        onClick={() => handleOpenStatusConfirm(cat)}
                        title={cat.active ? `Deactivate ${cat.categoryName}` : `Activate ${cat.categoryName}`}
                      >
                        {cat.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="modal-title" className="modal-title">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} noValidate>
              <div className="modal-body">
                {formErrors.general && (
                  <div className="alert alert-error">
                    <span>{formErrors.general}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="categoryName">
                    Category Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="categoryName"
                    name="categoryName"
                    type="text"
                    className={`form-input ${formErrors.categoryName ? 'input-error' : ''}`}
                    placeholder="e.g. Oil, Rice, Dhal, Masala"
                    value={formData.categoryName}
                    onChange={handleFormChange}
                    disabled={isSubmitting}
                    autoFocus
                  />
                  {formErrors.categoryName && (
                    <span className="field-error">{formErrors.categoryName}</span>
                  )}
                  <span className="form-help-text">
                    Unique English name for the category (max 191 chars)
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="tamilName">Tamil Name</label>
                  <input
                    id="tamilName"
                    name="tamilName"
                    type="text"
                    className="form-input tamil-text"
                    placeholder="e.g. எண்ணெய், அரிசி, பருப்பு"
                    value={formData.tamilName}
                    onChange={handleFormChange}
                    disabled={isSubmitting}
                  />
                  <span className="form-help-text">
                    Optional Tamil name for POS screens and printed receipts
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="displayOrder">
                    Display Order <span className="required-star">*</span>
                  </label>
                  <input
                    id="displayOrder"
                    name="displayOrder"
                    type="number"
                    min="0"
                    step="1"
                    className={`form-input font-mono ${formErrors.displayOrder ? 'input-error' : ''}`}
                    placeholder="0"
                    value={formData.displayOrder}
                    onChange={handleFormChange}
                    disabled={isSubmitting}
                  />
                  {formErrors.displayOrder && (
                    <span className="field-error">{formErrors.displayOrder}</span>
                  )}
                  <span className="form-help-text">
                    Non-negative integer controlling category list position (lower numbers appear first)
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Saving...
                    </>
                  ) : editingCategory ? (
                    'Update Category'
                  ) : (
                    'Create Category'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate / Deactivate Status Confirmation Modal */}
      {statusConfirmCategory && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="modal-dialog modal-dialog-sm">
            <div className="modal-header">
              <h3 id="confirm-title" className="modal-title">
                {statusConfirmCategory.active ? 'Deactivate Category' : 'Activate Category'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseStatusConfirm}
                disabled={isStatusChanging}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {statusConfirmCategory.active ? (
                <div className="confirm-content">
                  <p>
                    Are you sure you want to deactivate category{' '}
                    <strong>&ldquo;{statusConfirmCategory.categoryName}&rdquo;</strong>?
                  </p>
                  <div className="confirm-warning-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      Existing products in this category will remain intact and visible, but no new products can be assigned to it.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="confirm-content">
                  <p>
                    Are you sure you want to reactivate category{' '}
                    <strong>&ldquo;{statusConfirmCategory.categoryName}&rdquo;</strong>?
                  </p>
                  <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px' }}>
                    It will become active and available again for product assignment.
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCloseStatusConfirm}
                disabled={isStatusChanging}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${statusConfirmCategory.active ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleToggleStatus}
                disabled={isStatusChanging}
              >
                {isStatusChanging ? (
                  <>
                    <span className="btn-spinner"></span>
                    Processing...
                  </>
                ) : statusConfirmCategory.active ? (
                  'Deactivate Category'
                ) : (
                  'Activate Category'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

