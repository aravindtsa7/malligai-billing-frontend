import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { unitApi } from '../api/unit.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { UnitOfMeasure, CreateUnitInput, UpdateUnitInput } from '../types/unit.types.ts';

interface UnitFormData {
  name: string;
  shortName: string;
}

interface UnitFormErrors {
  name?: string;
  shortName?: string;
  general?: string;
}

export const UnitMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);
  const [formData, setFormData] = useState<UnitFormData>({
    name: '',
    shortName: '',
  });
  const [formErrors, setFormErrors] = useState<UnitFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Status Confirmation Dialog State
  const [statusConfirmUnit, setStatusConfirmUnit] = useState<UnitOfMeasure | null>(null);
  const [isStatusChanging, setIsStatusChanging] = useState<boolean>(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await unitApi.listUnits();
      setUnits(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load units of measure.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const data = await unitApi.listUnits();
        if (isMounted) {
          setUnits(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(getApiErrorMessage(err, 'Failed to load units of measure.'));
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
    setEditingUnit(null);
    setFormData({
      name: '',
      shortName: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (unit: UnitOfMeasure) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      shortName: unit.shortName,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
    setFormData({ name: '', shortName: '' });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: UnitFormErrors = {};
    const trimmedName = formData.name.trim();
    const trimmedShortName = formData.shortName.trim();

    if (!trimmedName) {
      errors.name = 'Unit Name is required.';
    } else if (trimmedName.length > 50) {
      errors.name = 'Unit Name cannot exceed 50 characters.';
    }

    if (!trimmedShortName) {
      errors.shortName = 'Short Name is required.';
    } else if (trimmedShortName.length > 20) {
      errors.shortName = 'Short Name cannot exceed 20 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormErrors({});

    try {
      if (editingUnit) {
        const updatePayload: UpdateUnitInput = {
          name: formData.name.trim(),
          shortName: formData.shortName.trim(),
        };
        const updated = await unitApi.updateUnit(editingUnit.id, updatePayload);
        setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setSuccessMessage(`Unit "${updated.name}" updated successfully.`);
      } else {
        const createPayload: CreateUnitInput = {
          name: formData.name.trim(),
          shortName: formData.shortName.trim(),
        };
        const created = await unitApi.createUnit(createPayload);
        setUnits((prev) => [...prev, created]);
        setSuccessMessage(`Unit "${created.name}" created successfully.`);
      }

      handleCloseModal();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Failed to save unit.');
      setFormErrors({ general: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStatusConfirm = (unit: UnitOfMeasure) => {
    setStatusConfirmUnit(unit);
  };

  const handleCloseStatusConfirm = () => {
    setStatusConfirmUnit(null);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirmUnit) return;

    setIsStatusChanging(true);
    const targetId = statusConfirmUnit.id;
    const newStatus = !statusConfirmUnit.active;

    try {
      const updated = await unitApi.updateUnitStatus(targetId, newStatus);
      setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      const actionText = newStatus ? 'activated' : 'deactivated';
      setSuccessMessage(`Unit "${updated.name}" ${actionText} successfully.`);
      handleCloseStatusConfirm();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, `Failed to change status for "${statusConfirmUnit.name}".`));
      handleCloseStatusConfirm();
    } finally {
      setIsStatusChanging(false);
    }
  };

  // Keyboard Escape listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen && !isSubmitting) {
          handleCloseModal();
        }
        if (statusConfirmUnit && !isStatusChanging) {
          handleCloseStatusConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isSubmitting, statusConfirmUnit, isStatusChanging]);

  return (
    <div className="unit-master-page">
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
            <span className="breadcrumb-current">Units</span>
          </div>
          <h2 className="page-title">Unit of Measure</h2>
          <span className="page-subtitle">
            Manage units of measure for products, inventory and billing
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
            onClick={fetchUnits}
            disabled={loading}
            title="Refresh Unit List"
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddModal}
          >
            + Add Unit
          </button>
        </div>
      </div>

      {/* Notifications */}
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

      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={fetchUnits}
          >
            Retry
          </button>
        </div>
      )}

      {/* Units Table Card */}
      <div className="data-table-container">
        {loading && units.length === 0 ? (
          <div className="table-loading-state">
            <div className="auth-spinner"></div>
            <p>Loading units of measure...</p>
          </div>
        ) : units.length === 0 ? (
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
                <path d="M2 12h20" />
                <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
                <path d="M6 12V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5" />
              </svg>
            </div>
            <h3>No units found</h3>
            <p>
              Get started by adding your first unit of measure.{' '}
              <button
                type="button"
                className="link-button"
                onClick={handleOpenAddModal}
              >
                + Add Unit
              </button>
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>UNIT NAME</th>
                <th style={{ width: '160px' }}>SHORT NAME</th>
                <th className="text-center" style={{ width: '130px' }}>STATUS</th>
                <th className="text-center" style={{ width: '190px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className={!unit.active ? 'row-inactive' : ''}>
                  <td className="font-semibold text-primary">{unit.name}</td>
                  <td className="font-mono font-semibold">
                    <span className="unit-badge">{unit.shortName}</span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`status-badge ${
                        unit.active ? 'status-active' : 'status-inactive'
                      }`}
                    >
                      {unit.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="table-action-group">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleOpenEditModal(unit)}
                        title={`Edit ${unit.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          unit.active
                            ? 'btn-status-deactivate'
                            : 'btn-status-activate'
                        }`}
                        onClick={() => handleOpenStatusConfirm(unit)}
                        title={
                          unit.active
                            ? `Deactivate ${unit.name}`
                            : `Activate ${unit.name}`
                        }
                      >
                        {unit.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Unit Modal */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-modal-title"
        >
          <div className="modal-dialog modal-dialog-sm">
            <div className="modal-header">
              <h3 id="unit-modal-title" className="modal-title">
                {editingUnit ? 'Edit Unit of Measure' : 'Add Unit of Measure'}
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

            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                {formErrors.general && (
                  <div className="alert alert-error">
                    <span>{formErrors.general}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="unit-name">
                    Unit Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="unit-name"
                    name="name"
                    type="text"
                    className={`form-input ${formErrors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Kilogram, Litre, Piece"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    maxLength={50}
                    disabled={isSubmitting}
                    autoFocus
                  />
                  {formErrors.name && (
                    <span className="field-error">{formErrors.name}</span>
                  )}
                  <span className="form-help-text">
                    Unique name for the unit of measure (e.g. Kilogram, Litre)
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="unit-short-name">
                    Short Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="unit-short-name"
                    name="shortName"
                    type="text"
                    className={`form-input font-mono ${
                      formErrors.shortName ? 'input-error' : ''
                    }`}
                    placeholder="e.g. kg, L, pcs"
                    value={formData.shortName}
                    onChange={(e) =>
                      setFormData({ ...formData, shortName: e.target.value })
                    }
                    maxLength={20}
                    disabled={isSubmitting}
                  />
                  {formErrors.shortName && (
                    <span className="field-error">{formErrors.shortName}</span>
                  )}
                  <span className="form-help-text">
                    Abbreviation printed on receipts, bills, and stock screens (e.g. kg)
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
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Saving...
                    </>
                  ) : editingUnit ? (
                    'Save Changes'
                  ) : (
                    'Create Unit'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Confirmation Modal */}
      {statusConfirmUnit && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-dialog-title"
        >
          <div className="modal-dialog modal-dialog-sm">
            <div className="modal-header">
              <h3 id="status-dialog-title" className="modal-title">
                {statusConfirmUnit.active ? 'Deactivate Unit' : 'Activate Unit'}
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
              {statusConfirmUnit.active ? (
                <div className="confirm-content">
                  <p>
                    Are you sure you want to deactivate unit{' '}
                    <strong>&ldquo;{statusConfirmUnit.name}&rdquo;</strong>?
                  </p>
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
                    <span>
                      Deactivated units cannot be assigned to new products or selected during edit. Existing products and historical bills using this unit will remain completely intact.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="confirm-content">
                  <p>
                    Are you sure you want to reactivate unit{' '}
                    <strong>&ldquo;{statusConfirmUnit.name}&rdquo;</strong>?
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
                className={`btn ${
                  statusConfirmUnit.active ? 'btn-danger' : 'btn-primary'
                }`}
                onClick={handleConfirmStatusChange}
                disabled={isStatusChanging}
              >
                {isStatusChanging ? (
                  <>
                    <span className="btn-spinner"></span>
                    Processing...
                  </>
                ) : statusConfirmUnit.active ? (
                  'Yes, Deactivate'
                ) : (
                  'Yes, Activate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitMasterPage;
