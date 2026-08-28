import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { userApi } from '../api/user.api.ts';
import { getApiErrorMessage } from '../api/api-client.ts';
import type { User, Role, UserPagination } from '../types/user.types.ts';

interface AddFormErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface PasswordResetErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export const SalesmanManagementPage: React.FC = () => {
  const navigate = useNavigate();

  // Data & Pagination State
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<UserPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageLimit] = useState<number>(20);

  // Request counter to avoid race conditions
  const activeRequestIdRef = useRef<number>(0);

  // =========================================================================
  // Add Salesman Modal State
  // =========================================================================
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [addUsername, setAddUsername] = useState<string>('');
  const [addPassword, setAddPassword] = useState<string>('');
  const [addConfirmPassword, setAddConfirmPassword] = useState<string>('');
  const [showAddPassword, setShowAddPassword] = useState<boolean>(false);
  const [showAddConfirmPassword, setShowAddConfirmPassword] = useState<boolean>(false);
  const [addErrors, setAddErrors] = useState<AddFormErrors>({});
  const [isAddSubmitting, setIsAddSubmitting] = useState<boolean>(false);

  // =========================================================================
  // Status Confirmation Modal State
  // =========================================================================
  const [statusConfirmUser, setStatusConfirmUser] = useState<User | null>(null);
  const [isStatusChanging, setIsStatusChanging] = useState<boolean>(false);

  // =========================================================================
  // Reset Password Modal State
  // =========================================================================
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState<boolean>(false);
  const [passwordErrors, setPasswordErrors] = useState<PasswordResetErrors>({});
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState<boolean>(false);

  // =========================================================================
  // Data Fetching
  // =========================================================================
  const fetchUsers = useCallback(async (pageToLoad: number = currentPage) => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const queryParams: {
        page: number;
        limit: number;
        role?: Role;
        active?: boolean;
      } = {
        page: pageToLoad,
        limit: pageLimit,
      };

      if (roleFilter !== 'ALL') {
        queryParams.role = roleFilter;
      }

      if (statusFilter === 'ACTIVE') {
        queryParams.active = true;
      } else if (statusFilter === 'INACTIVE') {
        queryParams.active = false;
      }

      const result = await userApi.listUsers(queryParams);

      if (requestId === activeRequestIdRef.current) {
        setUsers(result.users);
        setPagination(result.pagination);
      }
    } catch (err: unknown) {
      if (requestId === activeRequestIdRef.current) {
        setError(getApiErrorMessage(err, 'Failed to load user accounts.'));
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [roleFilter, statusFilter, currentPage, pageLimit]);

  useEffect(() => {
    let isMounted = true;
    const requestId = ++activeRequestIdRef.current;

    const load = async () => {
      try {
        const queryParams: {
          page: number;
          limit: number;
          role?: Role;
          active?: boolean;
        } = {
          page: currentPage,
          limit: pageLimit,
        };

        if (roleFilter !== 'ALL') {
          queryParams.role = roleFilter;
        }

        if (statusFilter === 'ACTIVE') {
          queryParams.active = true;
        } else if (statusFilter === 'INACTIVE') {
          queryParams.active = false;
        }

        const result = await userApi.listUsers(queryParams);

        if (isMounted && requestId === activeRequestIdRef.current) {
          setUsers(result.users);
          setPagination(result.pagination);
        }
      } catch (err: unknown) {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setError(getApiErrorMessage(err, 'Failed to load user accounts.'));
        }
      } finally {
        if (isMounted && requestId === activeRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [roleFilter, statusFilter, currentPage, pageLimit]);

  const showToastSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // =========================================================================
  // Handlers: Add Salesman
  // =========================================================================
  const handleOpenAddModal = () => {
    setAddUsername('');
    setAddPassword('');
    setAddConfirmPassword('');
    setShowAddPassword(false);
    setShowAddConfirmPassword(false);
    setAddErrors({});
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = useCallback(() => {
    if (isAddSubmitting) return;
    setAddUsername('');
    setAddPassword('');
    setAddConfirmPassword('');
    setShowAddPassword(false);
    setShowAddConfirmPassword(false);
    setAddErrors({});
    setIsAddModalOpen(false);
  }, [isAddSubmitting]);

  const validateAddForm = (): boolean => {
    const errors: AddFormErrors = {};
    const trimmedUsername = addUsername.trim();

    if (!trimmedUsername) {
      errors.username = 'Username is required';
    } else if (trimmedUsername.length > 50) {
      errors.username = 'Username cannot exceed 50 characters';
    }

    if (!addPassword) {
      errors.password = 'Password is required';
    } else if (addPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!addConfirmPassword) {
      errors.confirmPassword = 'Confirm Password is required';
    } else if (addPassword !== addConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddSubmitting) return;

    if (!validateAddForm()) {
      return;
    }

    setIsAddSubmitting(true);
    setAddErrors({});

    try {
      const createdUser = await userApi.createUser({
        username: addUsername.trim(),
        password: addPassword,
      });

      // Clear password memory immediately
      setAddPassword('');
      setAddConfirmPassword('');
      setAddUsername('');
      setIsAddModalOpen(false);

      showToastSuccess(`Salesman account "${createdUser.username}" created successfully.`);
      await fetchUsers(1);
      setCurrentPage(1);
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err, 'Failed to create salesman account.');
      // Inspect for duplicate username / unique violation
      if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('unique constraint')) {
        setAddErrors({
          username: `Username "${addUsername.trim()}" is already in use. Please choose another username.`,
        });
      } else {
        setAddErrors({ general: errMsg });
      }
    } finally {
      setIsAddSubmitting(false);
    }
  };

  // =========================================================================
  // Handlers: Status Activate / Deactivate
  // =========================================================================
  const handleOpenStatusConfirm = (user: User) => {
    // Safety check: Never open status toggle for ADMIN
    if (user.role === 'ADMIN') return;
    setStatusConfirmUser(user);
  };

  const handleCloseStatusConfirm = useCallback(() => {
    if (isStatusChanging) return;
    setStatusConfirmUser(null);
  }, [isStatusChanging]);

  const handleToggleStatus = async () => {
    if (!statusConfirmUser || isStatusChanging) return;
    if (statusConfirmUser.role === 'ADMIN') {
      setStatusConfirmUser(null);
      return;
    }

    setIsStatusChanging(true);
    try {
      const newStatus = !statusConfirmUser.active;
      const updatedUser = await userApi.updateUserStatus(statusConfirmUser.id, newStatus);

      const actionText = newStatus ? 'activated' : 'deactivated';
      showToastSuccess(`Salesman "${updatedUser.username}" ${actionText} successfully.`);
      setStatusConfirmUser(null);
      await fetchUsers(currentPage);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update user status.'));
      setStatusConfirmUser(null);
    } finally {
      setIsStatusChanging(false);
    }
  };

  // =========================================================================
  // Handlers: Password Reset
  // =========================================================================
  const handleOpenPasswordReset = (user: User) => {
    // Safety check: Never open password reset for ADMIN
    if (user.role === 'ADMIN') return;
    setPasswordResetUser(user);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordErrors({});
  };

  const handleClosePasswordReset = useCallback(() => {
    if (isPasswordSubmitting) return;
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordErrors({});
    setPasswordResetUser(null);
  }, [isPasswordSubmitting]);

  const validatePasswordResetForm = (): boolean => {
    const errors: PasswordResetErrors = {};

    if (!newPassword) {
      errors.password = 'New password is required';
    } else if (newPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!confirmNewPassword) {
      errors.confirmPassword = 'Confirm new password is required';
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordSubmitting || !passwordResetUser) return;

    if (!validatePasswordResetForm()) {
      return;
    }

    setIsPasswordSubmitting(true);
    setPasswordErrors({});

    try {
      await userApi.resetPassword(passwordResetUser.id, {
        password: newPassword,
      });

      const username = passwordResetUser.username;

      // Purge password values from state immediately
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordResetUser(null);

      showToastSuccess(`Password updated successfully for "${username}".`);
    } catch (err: unknown) {
      setPasswordErrors({
        general: getApiErrorMessage(err, 'Failed to reset password.'),
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  // Keyboard Escape listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen && !isAddSubmitting) {
          handleCloseAddModal();
        }
        if (statusConfirmUser && !isStatusChanging) {
          handleCloseStatusConfirm();
        }
        if (passwordResetUser && !isPasswordSubmitting) {
          handleClosePasswordReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isAddModalOpen,
    isAddSubmitting,
    statusConfirmUser,
    isStatusChanging,
    passwordResetUser,
    isPasswordSubmitting,
    handleCloseAddModal,
    handleCloseStatusConfirm,
    handleClosePasswordReset,
  ]);

  // =========================================================================
  // Client Filtering (Search by Username)
  // =========================================================================
  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    return u.username.toLowerCase().includes(searchTerm.trim().toLowerCase());
  });

  const activeSalesmenCount = users.filter((u) => u.role === 'SALESMAN' && u.active).length;
  const totalSalesmenCount = users.filter((u) => u.role === 'SALESMAN').length;

  return (
    <div className="salesman-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              Admin
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Salesman Accounts</span>
          </div>
          <h2 className="page-title">Salesman Management</h2>
          <span className="page-subtitle">
            Configure staff credentials, manage terminal login status, and perform secure password resets
          </span>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/admin')}
            title="Return to Admin Dashboard"
          >
            ← Back to Dashboard
          </button>
          <button
            type="button"
            className="btn btn-outline btn-refresh"
            onClick={() => fetchUsers(currentPage)}
            disabled={loading}
            title="Refresh accounts list"
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
            title="Create a new counter salesman account"
          >
            + Add Salesman
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
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

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error alert-dismissible">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => fetchUsers(currentPage)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Informational Context Banner */}
      <div className="salesman-info-banner">
        <div className="salesman-info-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="salesman-info-content">
          <strong>Staff Access &amp; Audit Trail Protection:</strong> Salesman accounts are authorized to operate POS Billing Terminals. Deactivating an account immediately blocks subsequent login and authenticated operations. In accordance with financial audit requirements, <strong>accounts cannot be deleted</strong>; all bills, receipts, and inventory transactions generated by deactivated salesmen remain permanently linked to their user record.
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="salesman-filter-card">
        <div className="salesman-filters-group">
          {/* Username Search */}
          <div className="salesman-search-wrapper">
            <svg
              className="salesman-search-icon"
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="form-input salesman-search-input"
              placeholder="Search by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Role Filter */}
          <div className="history-filter-item">
            <label className="history-filter-label">Role:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Role Filter">
              {(['ALL', 'SALESMAN', 'ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`pill-btn ${roleFilter === r ? 'pill-btn-active' : ''}`}
                  onClick={() => {
                    setRoleFilter(r);
                    setCurrentPage(1);
                  }}
                  role="radio"
                  aria-checked={roleFilter === r}
                >
                  {r === 'ALL' ? 'All Roles' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="history-filter-item">
            <label className="history-filter-label">Status:</label>
            <div className="pill-buttons-row" role="radiogroup" aria-label="Status Filter">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`pill-btn ${statusFilter === st ? 'pill-btn-active' : ''}`}
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  role="radio"
                  aria-checked={statusFilter === st}
                >
                  {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="user-count-summary">
          Showing <strong>{filteredUsers.length}</strong> of <strong>{pagination.total}</strong> accounts ({activeSalesmenCount} of {totalSalesmenCount} salesmen active)
        </div>
      </div>

      {/* Users Data Table */}
      <div className="data-table-container">
        {loading ? (
          <div className="table-loading-state">
            <div className="auth-spinner"></div>
            <p>Loading accounts...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>No user accounts found</h3>
            <p>
              {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                <>No accounts match the current filter criteria.</>
              ) : (
                <>
                  Get started by adding your first salesman account.{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={handleOpenAddModal}
                  >
                    + Add Salesman
                  </button>
                </>
              )}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }} className="text-center">ID</th>
                <th>Username</th>
                <th style={{ width: '120px' }}>Role</th>
                <th className="text-center" style={{ width: '110px' }}>Status</th>
                <th style={{ width: '170px' }}>Created At</th>
                <th style={{ width: '170px' }}>Updated At</th>
                <th className="text-center" style={{ width: '230px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isAdmin = u.role === 'ADMIN';

                return (
                  <tr
                    key={u.id}
                    className={!u.active ? 'row-inactive' : ''}
                  >
                    {/* User ID */}
                    <td className="text-center">
                      <span className="user-id-pill">#{u.id}</span>
                    </td>

                    {/* Username */}
                    <td>
                      <div className="user-username-cell">
                        <div
                          className={`user-avatar-pill ${isAdmin ? 'user-avatar-admin' : ''}`}
                          aria-hidden="true"
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-primary">{u.username}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td>
                      <span className={`role-badge role-${u.role.toLowerCase()}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="text-center">
                      <span className={`status-badge ${u.active ? 'status-active' : 'status-inactive'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="text-muted" style={{ fontSize: '12.5px' }}>
                      {new Date(u.createdAt).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Updated Date */}
                    <td className="text-muted" style={{ fontSize: '12.5px' }}>
                      {new Date(u.updatedAt).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="text-center">
                      {isAdmin ? (
                        <span
                          className="admin-protected-tag"
                          title="Administrator accounts cannot be modified or reset via the Salesman Management interface"
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
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          Protected (Admin)
                        </span>
                      ) : (
                        <div className="table-action-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => handleOpenPasswordReset(u)}
                            title={`Reset password for ${u.username}`}
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${u.active ? 'btn-status-deactivate' : 'btn-status-activate'}`}
                            onClick={() => handleOpenStatusConfirm(u)}
                            title={u.active ? `Deactivate ${u.username}` : `Activate ${u.username}`}
                          >
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="history-pagination-bar">
            <div className="pagination-info">
              Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total accounts)
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={currentPage >= pagination.totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          Modal 1: Add Salesman Modal
          ===================================================================== */}
      {isAddModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-salesman-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="add-salesman-title" className="modal-title">
                Add Salesman Account
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseAddModal}
                disabled={isAddSubmitting}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} noValidate>
              <div className="modal-body">
                {addErrors.general && (
                  <div className="alert alert-error">
                    <span>{addErrors.general}</span>
                  </div>
                )}

                {/* Role Note */}
                <div className="confirm-warning-box" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>
                    New accounts are automatically created with the <strong>SALESMAN</strong> role and active counter terminal access.
                  </span>
                </div>

                {/* Username Input */}
                <div className="form-group">
                  <label htmlFor="addUsername">
                    Username <span className="required-star">*</span>
                  </label>
                  <input
                    id="addUsername"
                    name="username"
                    type="text"
                    className={`form-input ${addErrors.username ? 'input-error' : ''}`}
                    placeholder="e.g. salesman1, counter_staff"
                    value={addUsername}
                    onChange={(e) => {
                      setAddUsername(e.target.value);
                      if (addErrors.username) {
                        setAddErrors((prev) => ({ ...prev, username: undefined }));
                      }
                    }}
                    maxLength={50}
                    disabled={isAddSubmitting}
                    autoFocus
                  />
                  {addErrors.username && (
                    <span className="field-error">{addErrors.username}</span>
                  )}
                  <span className="form-help-text">
                    Unique username for counter terminal login (max 50 chars)
                  </span>
                </div>

                {/* Password Input */}
                <div className="form-group">
                  <label htmlFor="addPassword">
                    Password <span className="required-star">*</span>
                  </label>
                  <div className="input-password-wrapper">
                    <input
                      id="addPassword"
                      name="password"
                      type={showAddPassword ? 'text' : 'password'}
                      className={`form-input ${addErrors.password ? 'input-error' : ''}`}
                      placeholder="Minimum 6 characters"
                      value={addPassword}
                      onChange={(e) => {
                        setAddPassword(e.target.value);
                        if (addErrors.password) {
                          setAddErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      disabled={isAddSubmitting}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowAddPassword((prev) => !prev)}
                      tabIndex={-1}
                      title={showAddPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAddPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {addErrors.password && (
                    <span className="field-error">{addErrors.password}</span>
                  )}
                  <span className="form-help-text">
                    Secret password for staff login (at least 6 characters)
                  </span>
                </div>

                {/* Confirm Password Input */}
                <div className="form-group">
                  <label htmlFor="addConfirmPassword">
                    Confirm Password <span className="required-star">*</span>
                  </label>
                  <div className="input-password-wrapper">
                    <input
                      id="addConfirmPassword"
                      name="confirmPassword"
                      type={showAddConfirmPassword ? 'text' : 'password'}
                      className={`form-input ${addErrors.confirmPassword ? 'input-error' : ''}`}
                      placeholder="Re-enter password to confirm"
                      value={addConfirmPassword}
                      onChange={(e) => {
                        setAddConfirmPassword(e.target.value);
                        if (addErrors.confirmPassword) {
                          setAddErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      disabled={isAddSubmitting}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowAddConfirmPassword((prev) => !prev)}
                      tabIndex={-1}
                      title={showAddConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showAddConfirmPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {addErrors.confirmPassword && (
                    <span className="field-error">{addErrors.confirmPassword}</span>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCloseAddModal}
                  disabled={isAddSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-save"
                  disabled={isAddSubmitting}
                >
                  {isAddSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Creating...
                    </>
                  ) : (
                    'Create Salesman'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          Modal 2: Status Toggle Confirmation Modal
          ===================================================================== */}
      {statusConfirmUser && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-status-title"
        >
          <div className="modal-dialog modal-dialog-sm">
            <div className="modal-header">
              <h3 id="confirm-status-title" className="modal-title">
                {statusConfirmUser.active ? 'Deactivate Salesman' : 'Activate Salesman'}
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
              {statusConfirmUser.active ? (
                <div className="confirm-content">
                  <p>
                    Are you sure you want to deactivate salesman account{' '}
                    <strong>&ldquo;{statusConfirmUser.username}&rdquo;</strong> (ID: #{statusConfirmUser.id})?
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
                    <div>
                      <strong>Access &amp; Audit Implications:</strong>
                      <ul style={{ paddingLeft: '16px', marginTop: '4px', lineHeight: '1.4' }}>
                        <li>This account will immediately lose ability to log in or process counter billing.</li>
                        <li>The account is <strong>not deleted</strong>.</li>
                        <li>All historical bills and inventory logs created by {statusConfirmUser.username} remain safely preserved.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="confirm-content">
                  <p>
                    Are you sure you want to reactivate salesman account{' '}
                    <strong>&ldquo;{statusConfirmUser.username}&rdquo;</strong> (ID: #{statusConfirmUser.id})?
                  </p>
                  <p className="text-muted" style={{ fontSize: '13px', marginTop: '6px' }}>
                    The salesman will immediately be able to log in to the billing terminal with their existing credentials.
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
                className={`btn ${statusConfirmUser.active ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleToggleStatus}
                disabled={isStatusChanging}
              >
                {isStatusChanging ? (
                  <>
                    <span className="btn-spinner"></span>
                    Processing...
                  </>
                ) : statusConfirmUser.active ? (
                  'Deactivate Salesman'
                ) : (
                  'Activate Salesman'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          Modal 3: Reset Password Modal
          ===================================================================== */}
      {passwordResetUser && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="reset-password-title" className="modal-title">
                Reset Password for &ldquo;{passwordResetUser.username}&rdquo;
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleClosePasswordReset}
                disabled={isPasswordSubmitting}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} noValidate>
              <div className="modal-body">
                {passwordErrors.general && (
                  <div className="alert alert-error">
                    <span>{passwordErrors.general}</span>
                  </div>
                )}

                <div className="confirm-content">
                  <p className="text-muted" style={{ fontSize: '13px' }}>
                    Enter a new password for salesman account <strong>{passwordResetUser.username}</strong> (ID: #{passwordResetUser.id}). The user must use this new password on their subsequent login.
                  </p>
                </div>

                {/* New Password Input */}
                <div className="form-group">
                  <label htmlFor="newPassword">
                    New Password <span className="required-star">*</span>
                  </label>
                  <div className="input-password-wrapper">
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      className={`form-input ${passwordErrors.password ? 'input-error' : ''}`}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordErrors.password) {
                          setPasswordErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      disabled={isPasswordSubmitting}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      tabIndex={-1}
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {passwordErrors.password && (
                    <span className="field-error">{passwordErrors.password}</span>
                  )}
                  <span className="form-help-text">
                    New login password (at least 6 characters)
                  </span>
                </div>

                {/* Confirm New Password Input */}
                <div className="form-group">
                  <label htmlFor="confirmNewPassword">
                    Confirm New Password <span className="required-star">*</span>
                  </label>
                  <div className="input-password-wrapper">
                    <input
                      id="confirmNewPassword"
                      name="confirmNewPassword"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      className={`form-input ${passwordErrors.confirmPassword ? 'input-error' : ''}`}
                      placeholder="Re-enter new password to confirm"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        if (passwordErrors.confirmPassword) {
                          setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      disabled={isPasswordSubmitting}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                      tabIndex={-1}
                      title={showConfirmNewPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmNewPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {passwordErrors.confirmPassword && (
                    <span className="field-error">{passwordErrors.confirmPassword}</span>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleClosePasswordReset}
                  disabled={isPasswordSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-save"
                  disabled={isPasswordSubmitting}
                >
                  {isPasswordSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Updating...
                    </>
                  ) : (
                    'Update Password'
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
