import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { receiptSettingsApi } from '../api/receipt-settings.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { UpdateReceiptSettingsInput } from '../types/receipt-settings.types.ts';

interface FormData {
  storeName: string;
  upiId: string;
  gstin: string;
  showCashier: boolean;
  showRateTier: boolean;
  showPayment: boolean;
  showStatus: boolean;
}

interface FormErrors {
  storeName?: string;
  upiId?: string;
  gstin?: string;
  general?: string;
}

export const ReceiptSettingsPage: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    storeName: '',
    upiId: '',
    gstin: '',
    showCashier: true,
    showRateTier: true,
    showPayment: true,
    showStatus: true,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadInitialSettings = async () => {
      try {
        const settings = await receiptSettingsApi.getReceiptSettings();
        if (isMounted) {
          setFormData({
            storeName: settings.storeName || '',
            upiId: settings.upiId || '',
            gstin: settings.gstin || '',
            showCashier: settings.showCashier,
            showRateTier: settings.showRateTier,
            showPayment: settings.showPayment,
            showStatus: settings.showStatus,
          });
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrors({
            general: getApiErrorMessage(err, 'Failed to load receipt settings.'),
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.storeName.trim()) {
      newErrors.storeName = 'Store name is required';
    } else if (formData.storeName.trim().length > 191) {
      newErrors.storeName = 'Store name must not exceed 191 characters';
    }

    if (formData.upiId.trim().length > 191) {
      newErrors.upiId = 'UPI ID must not exceed 191 characters';
    }

    if (formData.gstin.trim().length > 191) {
      newErrors.gstin = 'GSTIN must not exceed 191 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      const payload: UpdateReceiptSettingsInput = {
        storeName: formData.storeName.trim(),
        upiId: formData.upiId.trim() || null,
        gstin: formData.gstin.trim() || null,
        showCashier: formData.showCashier,
        showRateTier: formData.showRateTier,
        showPayment: formData.showPayment,
        showStatus: formData.showStatus,
      };

      const updated = await receiptSettingsApi.updateReceiptSettings(payload);
      setFormData({
        storeName: updated.storeName || '',
        upiId: updated.upiId || '',
        gstin: updated.gstin || '',
        showCashier: updated.showCashier,
        showRateTier: updated.showRateTier,
        showPayment: updated.showPayment,
        showStatus: updated.showStatus,
      });
      setSuccessMessage('Receipt settings updated successfully!');
    } catch (err: unknown) {
      setErrors({
        general: getApiErrorMessage(err, 'Failed to update receipt settings.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="product-form-loading">
        <div className="auth-spinner"></div>
        <p>Loading receipt settings...</p>
      </div>
    );
  }

  return (
    <div className="receipt-settings-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              Admin
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Receipt Settings</span>
          </div>
          <h2 className="page-title">Receipt Settings</h2>
          <span className="page-subtitle">
            Configure store identity, tax/payment details, and receipt metadata visibility flags
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success alert-dismissible" style={{ marginBottom: 20 }}>
          <div className="alert-content-with-icon">
            <svg
              width="18"
              height="18"
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
          >
            ✕
          </button>
        </div>
      )}

      {errors.general && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <span>{errors.general}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="receipt-settings-form">
        {/* Section 1: Store & Payment Details */}
        <div className="form-card" style={{ marginBottom: 24 }}>
          <div className="form-card-header">
            <div className="section-step-badge">1</div>
            <div>
              <h3 className="form-card-title">Store Identity & Header</h3>
              <span className="form-card-desc">
                Header information printed at the top of customer receipts
              </span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group form-group-full">
              <label htmlFor="storeName">
                Store Name <span className="required-star">*</span>
              </label>
              <input
                id="storeName"
                name="storeName"
                type="text"
                className={`form-input ${errors.storeName ? 'input-error' : ''}`}
                placeholder="e.g. Malligai Stores"
                value={formData.storeName}
                onChange={handleChange}
                disabled={isSaving}
                autoFocus
              />
              {errors.storeName && <span className="field-error">{errors.storeName}</span>}
              <span className="form-help-text">
                Primary business name centered on thermal receipts
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="upiId">UPI ID (Optional)</label>
              <input
                id="upiId"
                name="upiId"
                type="text"
                className={`form-input font-mono ${errors.upiId ? 'input-error' : ''}`}
                placeholder="e.g. malligai@upi"
                value={formData.upiId}
                onChange={handleChange}
                disabled={isSaving}
              />
              {errors.upiId && <span className="field-error">{errors.upiId}</span>}
              <span className="form-help-text">
                Optional UPI handle printed below store name
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="gstin">GSTIN (Optional)</label>
              <input
                id="gstin"
                name="gstin"
                type="text"
                className={`form-input font-mono ${errors.gstin ? 'input-error' : ''}`}
                placeholder="e.g. 33ABCDE1234F1Z5"
                value={formData.gstin}
                onChange={handleChange}
                disabled={isSaving}
              />
              {errors.gstin && <span className="field-error">{errors.gstin}</span>}
              <span className="form-help-text">
                Optional GST identification number printed on receipt
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Metadata Visibility Flags */}
        <div className="form-card" style={{ marginBottom: 24 }}>
          <div className="form-card-header">
            <div className="section-step-badge">2</div>
            <div>
              <h3 className="form-card-title">Receipt Metadata Visibility</h3>
              <span className="form-card-desc">
                Control which transaction metadata rows are visible on printed receipts
              </span>
            </div>
          </div>

          <div className="receipt-flags-list">
            <div className="receipt-flag-item">
              <label className="toggle-switch-label" htmlFor="showCashier">
                <input
                  id="showCashier"
                  name="showCashier"
                  type="checkbox"
                  className="switch-checkbox"
                  checked={formData.showCashier}
                  onChange={handleChange}
                  disabled={isSaving}
                />
                <div className="flag-content">
                  <span className="flag-title">Show Cashier</span>
                  <span className="flag-desc">
                    Print the cashier username and role on customer receipts
                  </span>
                </div>
              </label>
            </div>

            <div className="receipt-flag-item">
              <label className="toggle-switch-label" htmlFor="showRateTier">
                <input
                  id="showRateTier"
                  name="showRateTier"
                  type="checkbox"
                  className="switch-checkbox"
                  checked={formData.showRateTier}
                  onChange={handleChange}
                  disabled={isSaving}
                />
                <div className="flag-content">
                  <span className="flag-title">Show Rate Tier</span>
                  <span className="flag-desc">
                    Print the billing rate tier (NORMAL, RETAIL, FUNCTION) on receipts
                  </span>
                </div>
              </label>
            </div>

            <div className="receipt-flag-item">
              <label className="toggle-switch-label" htmlFor="showPayment">
                <input
                  id="showPayment"
                  name="showPayment"
                  type="checkbox"
                  className="switch-checkbox"
                  checked={formData.showPayment}
                  onChange={handleChange}
                  disabled={isSaving}
                />
                <div className="flag-content">
                  <span className="flag-title">Show Payment</span>
                  <span className="flag-desc">
                    Print the payment method (CASH, UPI) on receipts
                  </span>
                </div>
              </label>
            </div>

            <div className="receipt-flag-item">
              <label className="toggle-switch-label" htmlFor="showStatus">
                <input
                  id="showStatus"
                  name="showStatus"
                  type="checkbox"
                  className="switch-checkbox"
                  checked={formData.showStatus}
                  onChange={handleChange}
                  disabled={isSaving}
                />
                <div className="flag-content">
                  <span className="flag-title">Show Status</span>
                  <span className="flag-desc">
                    Print the regular bill status row (COMPLETED / CANCELLED). Note: Cancelled bills will always retain clear void markings.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions-bar">
          <Link to="/admin" className="btn btn-outline">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary btn-save"
            disabled={isSaving}
          >
            {isSaving ? (
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
  );
};

export default ReceiptSettingsPage;
